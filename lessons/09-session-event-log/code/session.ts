/** SessionLog：append-only 会话事件流。 */
import { isJsonValue, type SessionEvent } from './events.ts'

export class SessionLog {
  private readonly events: SessionEvent[] = []
  private nextSeq = 1

  append(kind: string, data: Record<string, unknown>, time = new Date().toISOString()): SessionEvent {
    if (!isJsonValue(data)) {
      throw new Error(`事件数据必须可 JSON 序列化: ${kind}`)
    }
    const dataClone = structuredClone(data)
    Object.freeze(dataClone)
    const event = Object.freeze<SessionEvent>({
      seq: this.nextSeq,
      time,
      kind,
      data: dataClone,
    })
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

  /** 序列化为规范快照（可直接落盘）。 */
  snapshot(): string {
    return JSON.stringify(this.events)
  }

  /** 从快照还原事件数组（顺序与 seq 保持一致）。 */
  static replay(snapshot: string): SessionEvent[] {
    return JSON.parse(snapshot) as SessionEvent[]
  }
}
