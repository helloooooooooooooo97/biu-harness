import { nameFromSessionMascot } from './session-mascot-name.ts'
export { nameFromSessionMascot } from './session-mascot-name.ts'
export const SESSION_FORMAT_VERSION = 1

export type InboxKind = 'wake' | 'inject'

/** 谁写入这条 user/message：真人用户，或其它 session（如 Live 派工）。缺省按 user。 */
export type MessageSender =
  | { type: 'user' }
  | { type: 'session'; sessionId: string }

export type UserMessageImage = {
  name: string
  mime: string
  url: string
}

/** 写入 append 的正文（不含 seq/ts）；与 SessionEvent 判别联合一一对应。 */
export type SessionEventBody =
  | { type: 'session/open'; version: number }
  | { type: 'turn/start'; turn: number }
  | { type: 'turn/end'; turn: number; reason: string }
  | { type: 'step/start'; turn: number; step: number }
  | { type: 'step/end'; turn: number; step: number }
  | { type: 'system/prompt'; text: string }
  | { type: 'system/compact'; text: string }
  | { type: 'user/message'; text: string; kind: InboxKind; sender?: MessageSender; images?: UserMessageImage[] }
  | {
      type: 'assistant/message'
      text: string
      tool_calls?: Array<{ id: string; name: string; arguments: string }>
      usage?: {
        inputTokens: number
        outputTokens: number
        totalTokens?: number
        cacheReadTokens?: number
        /** 本次 LLM 输入中「历史 turn」占比（0..1）；由 agent-loop 在 derive 时统计挂载。curPct=1-histPct，无需单独存储。 */
        histPct?: number
      }
    }
  | { type: 'assistant/chunk'; text: string }
  | { type: 'tool/call'; id: string; name: string; arguments: string }
  | { type: 'tool/result'; id: string; name: string; ok: boolean; detail: string }

export type SessionEvent = SessionEventBody & {
  seq: number
  ts: number
}

/** 对齐 dsh workspace：Session 绑定 host 本机绝对路径，Agent 工具直接以此为 cwd。 */
export interface SessionProject {
  name: string
  path: string
  boundAt: number
}

/** Per-chat Grok shape+color(+eye) role — assigned once at create and persisted. */
export interface SessionMascot {
  shape: string
  color: string
  /** Resting eye morph frame; legacy records may omit and get backfilled. */
  eye?: number
}

/** Session 用途：普通对话 vs Live 指挥席。缺省按 chat 处理。 */
export type SessionType = 'chat' | 'live'

export function normalizeSessionType(value: unknown): SessionType {
  return value === 'live' ? 'live' : 'chat'
}

/** 会话级覆盖配置；未设字段回落到全局 chat-config。 */
export interface SessionConfig {
  /** 侧栏显示名；未设则仍用最近 user/message 推导 */
  title?: string
  provider?: 'deepseek' | 'openai' | 'anthropic'
  model?: string
  systemPrompt?: string
  agentMode?: 'standard' | 'minimal' | 'create'
  /** 极简模式下常驻额外工具 */
  extraTools?: string[]
  /** 侧栏标签；一条会话可属于多个标签组 */
  tags?: string[]
  /** 侧栏置顶 */
  pinned?: boolean
}

export function normalizeSessionConfig(value: unknown): SessionConfig | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const next: SessionConfig = {}
  if (typeof raw.title === 'string' && raw.title.trim()) next.title = raw.title.trim().slice(0, 80)
  if (raw.provider === 'deepseek' || raw.provider === 'openai' || raw.provider === 'anthropic') next.provider = raw.provider
  if (typeof raw.model === 'string' && raw.model.trim()) next.model = raw.model.trim()
  if (typeof raw.systemPrompt === 'string') next.systemPrompt = raw.systemPrompt
  if (raw.agentMode === 'standard' || raw.agentMode === 'minimal' || raw.agentMode === 'create') next.agentMode = raw.agentMode
  if (Array.isArray(raw.extraTools)) {
    next.extraTools = [...new Set(raw.extraTools.map((name) => String(name).trim()).filter(Boolean))]
  }
  if (Array.isArray(raw.tags)) {
    next.tags = [...new Set(raw.tags.map((name) => String(name).trim()).filter(Boolean))].slice(0, 24)
  }
  if (typeof raw.pinned === 'boolean') next.pinned = raw.pinned
  return Object.keys(next).length ? next : undefined
}

export function mergeSessionConfig(
  base: SessionConfig | undefined,
  patch: SessionConfig & { title?: string | null; systemPrompt?: string | null },
): SessionConfig | undefined {
  const next: SessionConfig = { ...(base ?? {}) }
  if ('title' in patch) {
    if (patch.title == null || !String(patch.title).trim()) delete next.title
    else next.title = String(patch.title).trim().slice(0, 80)
  }
  if (patch.provider === 'deepseek' || patch.provider === 'openai' || patch.provider === 'anthropic') next.provider = patch.provider
  if (typeof patch.model === 'string') {
    if (!patch.model.trim()) delete next.model
    else next.model = patch.model.trim()
  }
  if ('systemPrompt' in patch) {
    if (patch.systemPrompt == null) delete next.systemPrompt
    else next.systemPrompt = String(patch.systemPrompt)
  }
  if (patch.agentMode === 'standard' || patch.agentMode === 'minimal' || patch.agentMode === 'create') next.agentMode = patch.agentMode
  if (Array.isArray(patch.extraTools)) {
    next.extraTools = [...new Set(patch.extraTools.map((name) => String(name).trim()).filter(Boolean))]
  }
  if (Array.isArray(patch.tags)) {
    const tags = [...new Set(patch.tags.map((name) => String(name).trim()).filter(Boolean))].slice(0, 24)
    if (tags.length) next.tags = tags
    else delete next.tags
  }
  if (typeof patch.pinned === 'boolean') {
    if (patch.pinned) next.pinned = true
    else delete next.pinned
  }
  return Object.keys(next).length ? next : undefined
}

export interface SessionRecord {
  id: string
  version: number
  events: SessionEvent[]
  project?: SessionProject
  mascot?: SessionMascot
  type?: SessionType
  config?: SessionConfig
}

/** 侧栏列表用：不必加载整段 events。 */
export interface SessionSummary {
  id: string
  version: number
  eventCount: number
  title: string
  updatedAt: number
  project?: SessionProject
  mascot?: SessionMascot
  type?: SessionType
  config?: SessionConfig
}

export function deriveEventTitle(events: SessionEvent[], fallbackId: string): string {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]
    if (event?.type === 'user/message' && event.text.trim()) return event.text.slice(0, 48)
  }
  return fallbackId.slice(0, 8)
}

export function sessionDisplayTitle(record: {
  id: string
  events: SessionEvent[]
  config?: SessionConfig
  mascot?: SessionMascot
}): string {
  const named = record.config?.title?.trim()
  if (named) return named.slice(0, 80)
  const fromChat = deriveEventTitle(record.events, '')
  if (fromChat) return fromChat
  if (record.mascot) return nameFromSessionMascot(record.mascot)
  return record.id.slice(0, 8)
}

export interface SessionStore {
  load(id: string): Promise<SessionRecord | undefined>
  save(record: SessionRecord): Promise<void>
  list(): Promise<string[]>
  listSummaries(): Promise<SessionSummary[]>
  delete(id: string): Promise<boolean>
}
