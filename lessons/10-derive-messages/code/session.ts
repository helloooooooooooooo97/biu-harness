/**
 * SessionLog：append-only 事件流（session 的雏形）。
 */
export interface SessionEvent {
  seq?: number
  time?: string
  kind: string
  data?: Record<string, unknown>
  line?: number
}

export class SessionLog {
  private readonly events: SessionEvent[] = []
  private nextSeq = 1

  append(kind: string, data: Record<string, unknown>, time = new Date().toISOString()): SessionEvent {
    const ev: SessionEvent = { seq: this.nextSeq, time, kind, data }
    this.nextSeq += 1
    this.events.push(ev)
    return ev
  }

  get all(): readonly SessionEvent[] {
    return this.events
  }

  get length(): number {
    return this.events.length
  }
}
