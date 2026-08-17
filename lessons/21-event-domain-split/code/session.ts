/** SessionLog：只接受 durable 事件的 append-only 日志。 */
import { domainOf } from './events.ts'

export interface SessionEvent {
  seq: number
  kind: string
  data: Record<string, unknown>
}

export class SessionLog {
  private readonly events: SessionEvent[] = []
  private nextSeq = 1

  append(kind: string, data: Record<string, unknown>): SessionEvent {
    if (domainOf(kind) !== 'durable') {
      throw new Error(`live 事件不能写进会话日志: ${kind}`)
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
