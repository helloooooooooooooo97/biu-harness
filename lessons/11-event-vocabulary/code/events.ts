/**
 * 类型化事件词汇表：SessionEventMap（合并可扩展）+ @mode 元数据。
 */

export interface UserMessagePayload {
  role: 'user'
  content: string
  source?: { kind: 'user' | 'plugin' | 'model' | 'tool' }
}

export interface AssistantMessagePayload {
  message: { role: 'assistant'; content: unknown }
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

export interface ToolCallPayload {
  callId: string
  name: string
  /** 模型原样输出的参数 JSON 字符串。 */
  arguments: string
}

export interface ToolResultPayload {
  callId: string
  message: { role: 'tool'; content: unknown }
  isError?: boolean
}

/**
 * 核心会话事件表。插件通过声明合并扩展它（见 plugin-hook.ts 示例）。
 * 事件名 → 负载类型，是"模型可见即已记录"的编译期契约。
 */
export interface SessionEventMap {
  'turn/start': { turn: number }
  'turn/end': { turn: number; reason: string }
  'step/start': { turn: number; step: number }
  'step/end': { turn: number; step: number }
  'user/message': UserMessagePayload
  'assistant/chunk': { turn: number; step: number; chunk: { type: 'text'; text: string } }
  'assistant/message': { turn: number; step: number } & AssistantMessagePayload
  'tool/call': { turn: number; step: number } & ToolCallPayload
  'tool/result': { turn: number; step: number } & ToolResultPayload
  'todo/write': { todos: Array<{ id: string; text: string; done: boolean }> }
}

export type EventKind = keyof SessionEventMap

export type EventMode = 'emit' | 'waterfall' | 'parallel' | 'serial'

/** @mode 的运行时投影：每个事件的调度模式（第 15 课实现分发）。
 * 用 Partial 是因为插件声明合并会扩展 EventKind，插件应自行为新事件补充模式。 */
export const EVENT_MODES: Partial<Record<EventKind, EventMode>> = {
  'turn/start': 'emit',
  'turn/end': 'emit',
  'step/start': 'emit',
  'step/end': 'emit',
  'user/message': 'emit',
  'assistant/chunk': 'emit',
  'assistant/message': 'emit',
  'tool/call': 'emit',
  'tool/result': 'emit',
  'todo/write': 'emit',
}
