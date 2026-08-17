/** 会话服务接口：append-only 事件日志的读写契约。 */

export interface SessionEvent {
  seq: number
  kind: string
  data: Record<string, unknown>
}

export interface SessionHandle {
  readonly id: string
  append(kind: string, data: Record<string, unknown>): SessionEvent
  events(): readonly SessionEvent[]
}

export interface SessionService {
  create(id?: string): SessionHandle
  get(id: string): SessionHandle | undefined
  list(): string[]
}
