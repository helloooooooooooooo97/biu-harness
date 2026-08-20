export const SESSION_FORMAT_VERSION = 1

export type InboxKind = 'wake' | 'inject'

/** 写入 append 的正文（不含 seq/ts）；与 SessionEvent 判别联合一一对应。 */
export type SessionEventBody =
  | { type: 'session/open'; version: number }
  | { type: 'turn/start'; turn: number }
  | { type: 'turn/end'; turn: number; reason: string }
  | { type: 'step/start'; turn: number; step: number }
  | { type: 'step/end'; turn: number; step: number }
  | { type: 'system/prompt'; text: string }
  | { type: 'user/message'; text: string; kind: InboxKind }
  | { type: 'assistant/message'; text: string; tool_calls?: Array<{ id: string; name: string; arguments: string }> }
  | { type: 'assistant/chunk'; text: string }
  | { type: 'tool/call'; id: string; name: string; arguments: string }
  | { type: 'tool/result'; id: string; name: string; ok: boolean; detail: string }

export type SessionEvent = SessionEventBody & {
  seq: number
  ts: number
}

export interface SessionRecord {
  id: string
  version: number
  events: SessionEvent[]
}

export interface SessionStore {
  load(id: string): Promise<SessionRecord | undefined>
  save(record: SessionRecord): Promise<void>
  list(): Promise<string[]>
}
