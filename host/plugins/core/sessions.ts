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

export interface InputComposition {
  totalChars: number
  histChars: number
  curChars: number
  histPct: number
  curPct: number
}

/**
 * 统计发给 LLM 的输入中「历史 turn」与「本次 turn」的字数占比。
 * 独立纯函数，不改 deriveMessages 投影逻辑。
 * - 划分：turn/start..turn/end 为一个 turn；已完成 turn 的内容 = 历史(hist)，
 *   当前进行中 turn 的内容 + system prompt = 本次(cur)。
 * - 角色归类：user/message、assistant/message(含 tool_calls 的 arguments)、
 *   assistant/chunk、tool/call、tool/result 按所在 turn 计入；system/prompt、system/compact 计入当前 turn。
 * - 压缩点语义与 deriveMessages 对齐：context_compact_submit / session_compact 的
 *   tool/call 即压缩点，仅统计该点之后的事件（从压缩点重起）。
 * - 字数用字符长度。total 为 0 时各 pct 返回 0。
 */
export function statInputComposition(events: SessionEvent[]): InputComposition {
  const len = (s: string | null | undefined) => (s ? s.length : 0)
  const isCompact = (e: SessionEvent) =>
    e.type === 'tool/call' && (e.name === 'context_compact_submit' || e.name === 'session_compact')

  // —— 第一遍：定位「当前进行中 turn」= 有 turn/start 但尚无 turn/end 的最新 turn。
  //     与 deriveMessages 一致：仅统计最后一个压缩点之后的事件（无压缩点则全量）。 ——
  const lastCompactIdx = events.reduce((acc, e, i) => (isCompact(e) ? i : acc), -1)
  const started = new Set<number>()
  const ended = new Set<number>()
  for (let i = lastCompactIdx >= 0 ? lastCompactIdx + 1 : 0; i < events.length; i++) {
    const e = events[i]
    if (e.type === 'turn/start') started.add(e.turn)
    else if (e.type === 'turn/end') ended.add(e.turn)
  }
  let curTurn: number | null = null
  for (const t of started) {
    if (!ended.has(t) && (curTurn == null || t > curTurn)) curTurn = t
  }

  // —— 第二遍：按归属 turn 累计输入字数 ——
  let openTurn: number | null = null
  let systemChars = 0
  const byTurn = new Map<number, number>()

  const add = (owner: number | null, n: number) => {
    const key = owner ?? -1 // -1 表示 turn 边界外的孤立内容（归历史）
    byTurn.set(key, (byTurn.get(key) ?? 0) + n)
  }

  for (const event of events) {
    if (isCompact(event)) {
      // 压缩点：从点之后重算，丢弃点前历史（与 deriveMessages 一致）
      openTurn = null
      systemChars = 0
      byTurn.clear()
      continue
    }
    if (event.type === 'turn/start') {
      openTurn = event.turn
      continue
    }
    if (event.type === 'turn/end') {
      openTurn = null
      continue
    }
    switch (event.type) {
      case 'system/prompt':
      case 'system/compact':
        systemChars += len(event.text)
        break
      case 'user/message':
        add(openTurn, len(event.text))
        break
      case 'assistant/message':
        add(openTurn, len(event.text))
        for (const call of event.tool_calls ?? []) add(openTurn, len(call.arguments))
        break
      case 'assistant/chunk':
        add(openTurn, len(event.text))
        break
      case 'tool/call':
        add(openTurn, len(event.arguments))
        break
      case 'tool/result':
        add(openTurn, len(event.detail))
        break
    }
  }

  // 历史 = 非当前 turn 的内容（含 turn 边界外孤立内容的 -1 键，无进行中 turn 时全部为历史）；
  // 本次 = 当前进行中 turn 的内容 + system prompt。
  let histChars = 0
  for (const [turn, chars] of byTurn) {
    if (turn !== curTurn) histChars += chars
  }
  let curChars = systemChars
  if (curTurn != null) curChars += byTurn.get(curTurn) ?? 0

  const totalChars = histChars + curChars
  if (totalChars === 0) {
    return { totalChars: 0, histChars: 0, curChars: 0, histPct: 0, curPct: 0 }
  }
  const histPct = histChars / totalChars
  const curPct = curChars / totalChars
  return { totalChars, histChars, curChars, histPct, curPct }
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

  /** 统计当前事件日志的输入构成（历史/本次 turn 占比），与 deriveMessages 一致从压缩点后算。 */
  statInputComposition(id: string) {
    const record = this.cache.get(id)
    if (!record) throw new Error(`unknown session: ${id}`)
    return statInputComposition(record.events)
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
