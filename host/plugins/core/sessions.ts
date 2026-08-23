import { Service, type Context } from 'cordis'
import { basename, isAbsolute, resolve } from 'node:path'
import { realpath, stat } from 'node:fs/promises'
import '../../types.ts'
import { assistantContentForApi, type LlmMessage } from '../orchestration/llm.ts'
import type { AgentSendOptions, AgentHandle, AgentTurn } from '../orchestration/agents.ts'
import {
  SESSION_FORMAT_VERSION,
  type SessionEvent,
  type SessionEventBody,
  type SessionMascot,
  type SessionProject,
  type SessionRecord,
  type SessionType,
  type SessionConfig,
  type MessageSender,
  mergeSessionConfig,
  normalizeSessionConfig,
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

export type { SessionEvent, SessionEventBody, SessionProject, SessionRecord, SessionMascot, SessionType, SessionConfig }
export { SESSION_FORMAT_VERSION, normalizeSessionType, normalizeSessionConfig, mergeSessionConfig }
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
    // 压缩点：某次 context_compact_submit / session_compact 的 tool/call 即压缩点。
    // 从此处重起，丢弃该点之前的历史（避免重复发送旧 token）；摘要取该 tool 调用的 text 参数。
    if (event.type === 'tool/call' && (event.name === 'context_compact_submit' || event.name === 'session_compact')) {
      messages.length = 0
      pendingToolCalls.clear()
      let text = ''
      try {
        const args = JSON.parse(event.arguments || '{}') as { text?: string }
        text = String(args.text ?? '').trim()
      } catch {
        text = ''
      }
      if (text) {
        messages.push({ role: 'system', content: `[已压缩的历史摘要] ${text}` })
      }
    } else if (event.type === 'system/prompt') {
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

/** 粗略估算一段文本的 token 数（英文 ~1/4 字符，中日韩 ~1/1.5 字符）。 */
export function estimateTokens(text: string): number {
  let ascii = 0
  let cjk = 0
  for (const ch of text) {
    const c = ch.charCodeAt(0)
    if ((c >= 0x2e80 && c <= 0x9fff) || c >= 0x20000) cjk++
    else ascii++
  }
  return Math.ceil(ascii / 4 + cjk / 1.5)
}

function msgTokens(m: LlmMessage): number {
  const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
  return estimateTokens(content) + (typeof m.tool_calls?.length === 'number' ? m.tool_calls.length * 6 : 0)
}

/**
 * 滑动窗口 + 预算：消息总量超过预算时，保留"开头稳定锚点 + 最近 N 条"，丢弃中间旧消息。
 * 开头保留使 system/前缀相对稳定（利于缓存命中）；最近保留当前上下文。不影响短会话（不超预算原样返回）。
 */
export function applyContextBudget(messages: LlmMessage[], budgetTokens: number, keepRecent = 14): LlmMessage[] {
  if (budgetTokens <= 0 || messages.length === 0) return messages
  const total = messages.reduce((s, m) => s + msgTokens(m), 0)
  if (total <= budgetTokens) return messages
  // 保留最前 1 条(system/锚点) + 最近 N 条；其余丢弃
  const head = Math.max(1, messages[0]?.role === 'system' ? 1 : 0)
  const start = messages.slice(0, head)
  const tail = messages.slice(-keepRecent)
  return [...start, ...tail]
}

export class SessionsService extends Service {
  private cache = new Map<string, SessionRecord>()

  constructor(ctx: Context) {
    super(ctx, 'sessions')
  }

  async create(
    id: string = crypto.randomUUID(),
    opts: { type?: SessionType; title?: string; config?: SessionConfig } = {},
  ) {
    const used = await this.collectUsedMascots()
    const mascot = pickSessionMascot(id, used)
    const type = normalizeSessionType(opts.type)
    const seeded = normalizeSessionConfig({
      ...(opts.config ?? {}),
      ...(opts.title ? { title: opts.title } : {}),
    })
    const record: SessionRecord = {
      id,
      version: SESSION_FORMAT_VERSION,
      events: [{ type: 'session/open', version: SESSION_FORMAT_VERSION, seq: 0, ts: Date.now() }],
      mascot,
      type,
      ...(seeded ? { config: seeded } : {}),
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

  /**
   * 对外派工：向指定 session 的 agent 发送一条消息并启动回合。
   * 遵循封装原则——外部只依赖 Session，不直接操控 Agent。
   */
  async sendMessage(id: string, text: string, opts?: { wait?: boolean; sender?: MessageSender }): Promise<AgentTurn> {
    const handle = await this.agentHandle(id)
    return handle.send(text, opts as AgentSendOptions | undefined)
  }

  /** 对外注入：向指定 session 的 agent 注入一条待处理消息（不立即 start；忙时进 inbox）。 */
  async injectMessage(id: string, text: string, opts?: { sender?: MessageSender }): Promise<void> {
    const handle = await this.agentHandle(id)
    handle.inject(text, opts as AgentSendOptions | undefined)
  }

  /** 内部：拿到某 session 的 AgentHandle（封装在 session 层面，外部不可见 Agent 细节）。 */
  private async agentHandle(id: string): Promise<AgentHandle> {
    if (this.agentFactory) return this.agentFactory(id)
    throw new Error('agent factory not installed: agents 插件未就绪')
  }

  /**
   * 由 agents 插件在启动时安装"按 session 取 AgentHandle"的工厂。
   * 通过回调解耦，避免 sessions ↔ agents 的循环依赖：agents 依赖 sessions（单向），
   * 反向能力由 agents 通过此方法注入。
   */
  installAgentFactory(factory: (id: string) => Promise<AgentHandle> | AgentHandle): void {
    this.agentFactory = factory
  }

  private agentFactory: ((id: string) => Promise<AgentHandle> | AgentHandle) | null = null

  /** 合并写入会话配置；传 null/空字符串可清除 title / systemPrompt。 */
  async patchConfig(
    id: string,
    patch: SessionConfig & { title?: string | null; systemPrompt?: string | null },
  ) {
    const record = await this.require(id)
    const next = mergeSessionConfig(record.config, patch)
    if (next) record.config = next
    else delete record.config
    await this.persist(record)
    return record
  }

  async rename(id: string, title: string) {
    return this.patchConfig(id, { title })
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
