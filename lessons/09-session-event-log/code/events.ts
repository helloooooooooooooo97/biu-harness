/** 事件词汇表与 JSON 可序列化校验。 */

export const EVENT_KINDS = [
  'turn/start',
  'turn/end',
  'step/start',
  'step/end',
  'user/message',
  'assistant/chunk',
  'assistant/message',
  'tool/call',
  'tool/result',
] as const

export type EventKind = typeof EVENT_KINDS[number]

export interface SessionEvent {
  seq: number
  time: string
  kind: EventKind | string
  data: Record<string, unknown>
}

/** 判断值能否无损 JSON 序列化。 */
export function isJsonValue(value: unknown): boolean {
  if (value === null) return true
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true
    case 'number':
      return Number.isFinite(value)
    case 'undefined':
    case 'function':
    case 'symbol':
    case 'bigint':
      return false
    case 'object': {
      if (value instanceof Date || value instanceof Map || value instanceof Set) return false
      if (Array.isArray(value)) return value.every(isJsonValue)
      return Object.values(value).every(isJsonValue)
    }
    default:
      return false
  }
}
