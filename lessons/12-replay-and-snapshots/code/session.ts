/** SessionLog：append-only 事件流 + 快照/重放。 */

export interface SessionEvent {
  seq: number
  time: string
  kind: string
  data: Record<string, unknown>
}

export class SessionLog {
  private readonly events: SessionEvent[] = []
  private nextSeq = 1

  append(kind: string, data: Record<string, unknown>, time = new Date().toISOString()): SessionEvent {
    const event: SessionEvent = { seq: this.nextSeq, time, kind, data }
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

  /** 序列化成规范快照（可直接落盘）。 */
  snapshot(): string {
    return JSON.stringify(this.events)
  }

  /** 从快照还原事件数组（顺序与 seq 保持一致）。 */
  static replay(snapshot: string): SessionEvent[] {
    return JSON.parse(snapshot) as SessionEvent[]
  }
}
