/**
 * Agent：收件箱 + 生命周期状态的最小实现。
 */
import { Inbox, type UserMessage } from './inbox.ts'

export type AgentStatus = 'idle' | 'running'

export class Agent {
  readonly inbox = new Inbox()
  private _status: AgentStatus = 'idle'

  constructor(readonly id: string) {}

  get status(): AgentStatus {
    return this._status
  }

  /** 普通追问：唤醒驱动。 */
  followup(content: string): UserMessage {
    this._status = 'running'
    return this.inbox.followup(content)
  }

  /** 改写/指导最近一步：唤醒驱动。 */
  steer(content: string): UserMessage {
    this._status = 'running'
    return this.inbox.steer(content)
  }

  /** 注入上下文：不唤醒（idle 的 agent 保持 idle）。 */
  inject(content: string): UserMessage {
    return this.inbox.inject(content)
  }

  /** 模拟驱动到达空闲（第 42 课会真实化）。 */
  settle(): void {
    this._status = 'idle'
  }
}
