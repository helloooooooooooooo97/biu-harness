import { Service, type Context } from 'cordis'
import { basename, isAbsolute, resolve } from 'node:path'
import { realpath, stat } from 'node:fs/promises'
import '../../types.ts'
import { assistantContentForApi, type LlmMessage } from '../orchestration/llm.ts'
import {
  SESSION_FORMAT_VERSION,
  type SessionEvent,
  type SessionEventBody,
  type SessionMascot,
  type SessionProject,
  type SessionRecord,
  type SessionType,
  normalizeSessionType,
} from './session-types.ts'
import {
  ensureSessionMascot,
  isSessionMascot,
  mascotFromSessionId,
  pickSessionMascot,
  type SessionMascot as AssignedMascot,
} from './session-mascot.ts'
import { rebuildHealedEvents } from './session-heal.ts'

export type { SessionEvent, SessionEventBody, SessionProject, SessionRecord, SessionMascot, SessionType }
export { SESSION_FORMAT_VERSION, normalizeSessionType }
export {
  findOpenTurnStep,
  healInterruptedTurnBodies,
  rebuildHealedEvents,
} from './session-heal.ts'

export function deriveMessages(events: SessionEvent[]): LlmMessage[] {
  let system = ''
  const messages: LlmMessage[] = []
  /** 最近一条带 tool_calls 的 assistant 之后，尚未配齐的 tool_call_id */
  const pendingToolCalls = new Map<string, string>()

  const flushOrphanTools = () => {
    if (!pendingToolCalls.size) return
    for (const [id, name] of pendingToolCalls) {
      messages.push({
        role: 'tool',
        tool_call_id: id,
        content: `interrupted: missing tool result for ${name}`,
      })
    }
    pendingToolCalls.clear()
  }

  for (const event of events) {
    if (event.type === 'system/prompt') {
      system = event.text
    } else if (event.type === 'user/message') {
      flushOrphanTools()
      messages.push({ role: 'user', content: event.text })
    } else if (event.type === 'assistant/message') {
      flushOrphanTools()
      const hasToolCalls = Boolean(event.tool_calls?.length)
      messages.push({
        role: 'assistant',
        content: assistantContentForApi(event.text, hasToolCalls),
        ...(hasToolCalls
          ? {
              tool_calls: event.tool_calls!.map((call) => ({
                id: call.id,
                type: 'function',
                function: { name: call.name, arguments: call.arguments },
              })),
            }
          : {}),
      })
      if (hasToolCalls) {
        for (const call of event.tool_calls!) pendingToolCalls.set(call.id, call.name)
      }
    } else if (event.type === 'tool/result') {
      // 错位/重复的 tool/result 不能进 LLM（否则报 tool 必须跟在 tool_calls 后）
      if (!pendingToolCalls.has(event.id)) continue
      messages.push({ role: 'tool', tool_call_id: event.id, content: event.detail })
      pendingToolCalls.delete(event.id)
    }
  }
  flushOrphanTools()
  return system ? [{ role: 'system', content: system }, ...messages] : messages
}

export class SessionsService extends Service {
  private cache = new Map<string, SessionRecord>()

  constructor(ctx: Context) {
    super(ctx, 'sessions')
  }

  async create(id: string = crypto.randomUUID(), opts: { type?: SessionType } = {}) {
    const used = await this.collectUsedMascots()
    const mascot = pickSessionMascot(id, used)
    const type = normalizeSessionType(opts.type)
    const record: SessionRecord = {
      id,
      version: SESSION_FORMAT_VERSION,
      events: [{ type: 'session/open', version: SESSION_FORMAT_VERSION, seq: 0, ts: Date.now() }],
      mascot,
      type,
    }
    await this.persist(record)
    return record
  }

  /** 同步读缓存（Agent 工具解析会话项目根时用）。 */
  peek(id: string) {
    return this.cache.get(id)
  }

  async get(id: string) {
    const hit = this.cache.get(id)
    if (hit) return hit
    const loaded = await this.ctx.sessionStore.load(id)
    if (!loaded) return loaded
    const healed = await this.healOpenTurnsOnLoad(loaded)
    this.cache.set(id, healed)
    return healed
  }

  /**
   * 从磁盘拉起时：强行闭合未结束的 step/turn。
   * 重启后进程内 agent 已空，但日志若仍开着 turn，UI/Live 会一直显示 running，再发消息也会叠 turn。
   */
  private async healOpenTurnsOnLoad(record: SessionRecord): Promise<SessionRecord> {
    const rebuilt = rebuildHealedEvents(record.events)
    if (!rebuilt) return record
    record.events = rebuilt
    await this.persist(record)
    this.ctx.logger('sessions').info(
      `healed interrupted session log session=${record.id} events=${rebuilt.length}`,
    )
    return record
  }

  async require(id: string) {
    const record = await this.get(id)
    if (!record) throw new Error(`unknown session: ${id}`)
    return record
  }

  async append(id: string, body: SessionEventBody) {
    const record = await this.require(id)
    const event: SessionEvent = { ...body, seq: record.events.length, ts: Date.now() }
    record.events.push(event)
    this.cache.set(id, record)
    // chunk 极高频：先内存追加并广播，落盘合并到下一帧/定时器，避免每 token 全量 JSON 写盘
    if (body.type === 'assistant/chunk') {
      this.schedulePersist(id)
    } else {
      this.clearPersistTimer(id)
      await this.persist(record)
    }
    this.ctx.emit('session/event', { sessionId: id, event })
    return event
  }

  deriveMessages(id: string) {
    const record = this.cache.get(id)
    if (!record) throw new Error(`unknown session: ${id}`)
    return deriveMessages(record.events)
  }

  async fork(sourceId: string, childId: string = crypto.randomUUID()) {
    const source = await this.require(sourceId)
    const used = await this.collectUsedMascots()
    const mascot = pickSessionMascot(childId, used)
    const record: SessionRecord = {
      id: childId,
      version: source.version,
      events: source.events.map((event) => ({ ...event })),
      ...(source.project ? { project: { ...source.project } } : {}),
      mascot,
      type: normalizeSessionType(source.type),
    }
    await this.persist(record)
    return record
  }

  async setProject(id: string, project: { path: string } | null) {
    const record = await this.require(id)
    if (!project) {
      delete record.project
      await this.persist(record)
      return undefined
    }
    record.project = await resolveHostProject(project.path)
    await this.persist(record)
    return record.project
  }

  list() {
    return this.ctx.sessionStore.list()
  }

  async listSummaries() {
    const items = await this.ctx.sessionStore.listSummaries()
    const out = []
    for (const item of items) {
      let next = item
      if (!item.mascot || !isSessionMascot(item.mascot)) {
        // Legacy sessions: pin a stable mascot once and persist.
        const record = await this.require(item.id)
        if (!record.mascot || !isSessionMascot(record.mascot)) {
          record.mascot = mascotFromSessionId(record.id)
          await this.persist(record)
        } else {
          const ensured = ensureSessionMascot(record.id, record.mascot)
          if (ensured.eye !== record.mascot.eye) {
            record.mascot = ensured
            await this.persist(record)
          }
        }
        next = { ...next, mascot: record.mascot }
      } else {
        const ensured = ensureSessionMascot(item.id, item.mascot)
        if (ensured.eye !== item.mascot.eye) {
          const record = await this.require(item.id)
          record.mascot = ensured
          await this.persist(record)
          next = { ...next, mascot: ensured }
        }
      }
      const type = normalizeSessionType(next.type)
      if (next.type !== type) {
        const record = await this.require(item.id)
        if (normalizeSessionType(record.type) !== type) {
          record.type = type
          await this.persist(record)
        }
        next = { ...next, type }
      } else {
        next = { ...next, type }
      }
      out.push(next)
    }
    return out
  }

  private async collectUsedMascots(): Promise<AssignedMascot[]> {
    const items = await this.ctx.sessionStore.listSummaries()
    const used: AssignedMascot[] = []
    for (const item of items) {
      if (item.mascot && isSessionMascot(item.mascot)) used.push(item.mascot)
    }
    return used
  }

  async delete(id: string) {
    this.clearPersistTimer(id)
    this.cache.delete(id)
    return this.ctx.sessionStore.delete(id)
  }

  private persistTimers = new Map<string, ReturnType<typeof setTimeout>>()

  private schedulePersist(id: string) {
    if (this.persistTimers.has(id)) return
    this.persistTimers.set(
      id,
      setTimeout(() => {
        this.persistTimers.delete(id)
        const record = this.cache.get(id)
        if (record) void this.persist(record)
      }, 80),
    )
  }

  private clearPersistTimer(id: string) {
    const timer = this.persistTimers.get(id)
    if (timer == null) return
    clearTimeout(timer)
    this.persistTimers.delete(id)
  }

  private async persist(record: SessionRecord) {
    this.cache.set(record.id, record)
    await this.ctx.sessionStore.save(record)
  }
}

async function resolveHostProject(input: string): Promise<SessionProject> {
  const raw = String(input || '').trim()
  if (!raw) throw new Error('project path is required')
  const abs = resolve(raw)
  if (!isAbsolute(abs)) throw new Error('project path must be absolute')
  let real: string
  try {
    real = await realpath(abs)
  } catch {
    throw new Error(`project path does not exist: ${abs}`)
  }
  const info = await stat(real)
  if (!info.isDirectory()) throw new Error(`project path is not a directory: ${real}`)
  return { name: basename(real) || real, path: real, boundAt: Date.now() }
}

export const name = 'sessions'
export const inject = ['sessionStore']

export function apply(ctx: Context) {
  new SessionsService(ctx)
}
