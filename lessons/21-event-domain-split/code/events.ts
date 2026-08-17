/** 事件域划分：durable（进日志）vs live（只分发）。 */

export const DURABLE_KINDS = [
  'turn/start',
  'turn/end',
  'step/start',
  'step/end',
  'user/message',
  'assistant/chunk',
  'assistant/message',
  'tool/call',
  'tool/result',
  'todo/write',
] as const

export const LIVE_KINDS = [
  'agent/pre-step',
  'agent/status',
  'agent/request',
  'agent/turn-stopping',
] as const

export type EventKind = (typeof DURABLE_KINDS)[number] | (typeof LIVE_KINDS)[number]
export type EventDomain = 'durable' | 'live'

/** 查询事件所属域；未知事件返回 undefined（默认拒绝写入）。 */
export function domainOf(kind: string): EventDomain | undefined {
  if ((DURABLE_KINDS as readonly string[]).includes(kind)) return 'durable'
  if ((LIVE_KINDS as readonly string[]).includes(kind)) return 'live'
  return undefined
}
