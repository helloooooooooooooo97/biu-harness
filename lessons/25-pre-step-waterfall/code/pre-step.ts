/**
 * PreStepBus：agent/pre-step 瀑布——决定模型这一步看到什么。
 * enter（改写后开 step）或 reject（不开 step，短路）。
 */
import { EventBus, type Listener } from './event-bus.ts'

export interface UserMessage {
  id: string
  content: string
}

export interface PreStepPayload {
  messages: UserMessage[]
  turn: number
  step: number
}

export type PreStepDecision =
  | { kind: 'enter'; messages: UserMessage[] }
  | { kind: 'reject' }

/**
 * 监听器签名：(当前决策, payload, next)。
 * 调 next(新决策) 委托给下一个；不调 next 直接 return 决策则短路。
 */
export type PreStepListener = (
  decision: PreStepDecision,
  payload: PreStepPayload,
  next: (decision: PreStepDecision) => void,
) => PreStepDecision | void

export class PreStepBus {
  private readonly bus = new EventBus()

  on(listener: PreStepListener): () => void {
    return this.bus.on('agent/pre-step', listener as Listener)
  }

  /** 跑一次 pre-step：无监听器时默认 enter 原消息。 */
  run(payload: PreStepPayload): PreStepDecision {
    const initial: PreStepDecision = { kind: 'enter', messages: payload.messages }
    return this.bus.waterfall('agent/pre-step', initial, payload) as PreStepDecision
  }
}
