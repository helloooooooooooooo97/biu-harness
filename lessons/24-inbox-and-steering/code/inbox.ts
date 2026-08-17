/**
 * Inbox：agent 的输入收件箱。
 * next-turn（回合开场）与 next-step（插队）两个队列；claim 决定何时拿走。
 */

export interface UserMessage {
  id: string
  content: string
}

export class Inbox {
  private readonly nextTurn: UserMessage[] = []
  private readonly nextStep: UserMessage[] = []
  private idCounter = 0

  private nextId(): string {
    this.idCounter += 1
    return `m${this.idCounter}`
  }

  /** 普通追问：进 next-turn 队列（一次回合的开场）。 */
  followup(content: string): UserMessage {
    const message = { id: this.nextId(), content }
    this.nextTurn.push(message)
    return message
  }

  /** 改写/指导最近一步：进 next-step 队列并唤醒。 */
  steer(content: string): UserMessage {
    const message = { id: this.nextId(), content }
    this.nextStep.push(message)
    return message
  }

  /** 注入上下文（不唤醒）：进 next-step 队列，等下一个消息一起被看到。 */
  inject(content: string): UserMessage {
    const message = { id: this.nextId(), content }
    this.nextStep.push(message)
    return message
  }

  /** turn 边界 claim：取 1 条 next-turn + 全部 next-step。 */
  claimNextTurn(): { turnInput?: UserMessage; stepInputs: UserMessage[] } {
    return { turnInput: this.nextTurn.shift(), stepInputs: this.nextStep.splice(0) }
  }

  /** step 边界 claim：只取全部 next-step（工具续轮时插队消息生效）。 */
  claimNextStep(): UserMessage[] {
    return this.nextStep.splice(0)
  }

  get isEmpty(): boolean {
    return this.nextTurn.length === 0 && this.nextStep.length === 0
  }
}
