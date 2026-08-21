import { Service, type Context } from 'cordis'
import { basename, isAbsolute, resolve } from 'node:path'
import { realpath, stat } from 'node:fs/promises'
import '../../types.ts'
import { assistantContentForApi, type LlmMessage } from '../orchestration/llm.ts'
import {
  SESSION_FORMAT_VERSION,
  type SessionEvent,
  type SessionEventBody,
  type SessionProject,
  type SessionRecord,
} from './session-types.ts'

export type { SessionEvent, SessionEventBody, SessionProject, SessionRecord }
export { SESSION_FORMAT_VERSION }

export function deriveMessages(events: SessionEvent[]): LlmMessage[] {
  let system = ''
  const messages: LlmMessage[] = []
  for (const event of events) {
    if (event.type === 'system/prompt') {
      system = event.text
    } else if (event.type === 'user/message') {
      messages.push({ role: 'user', content: event.text })
    } else if (event.type === 'assistant/message') {
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
    } else if (event.type === 'tool/result') {
      messages.push({ role: 'tool', tool_call_id: event.id, content: event.detail })
    }
  }
  return system ? [{ role: 'system', content: system }, ...messages] : messages
}

export class SessionsService extends Service {
  private cache = new Map<string, SessionRecord>()

  constructor(ctx: Context) {
    super(ctx, 'sessions')
  }

  async create(id: string = crypto.randomUUID()) {
    const record: SessionRecord = {
      id,
      version: SESSION_FORMAT_VERSION,
      events: [{ type: 'session/open', version: SESSION_FORMAT_VERSION, seq: 0, ts: Date.now() }],
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
    if (loaded) this.cache.set(id, loaded)
    return loaded
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
    const record: SessionRecord = {
      id: childId,
      version: source.version,
      events: source.events.map((event) => ({ ...event })),
      ...(source.project ? { project: { ...source.project } } : {}),
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
