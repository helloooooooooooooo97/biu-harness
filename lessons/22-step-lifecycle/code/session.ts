/** SessionLog：只接受 durable 事件的 append-only 日志。 */

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

export interface SessionEvent {
  seq: number
  kind: string
  data: Record<string, unknown>
}

export class SessionLog {
  private readonly events: SessionEvent[] = []
  private nextSeq = 1

  append(kind: string, data: Record<string, unknown>): SessionEvent {
    if (!(DURABLE_KINDS as readonly string[]).includes(kind)) {
      throw new Error(`非 durable 事件不能写进会话日志: ${kind}`)
    }
    const event: SessionEvent = { seq: this.nextSeq, kind, data }
    this.nextSeq += 1
    this.events.push(event)
    return event
  }

  get all(): readonly SessionEvent[] {
    return this.events
  }

  get length(): number {
    return this.events.length
  }
}
