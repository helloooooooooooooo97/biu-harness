/**
 * core-agent-loop：step/turn 生命周期 + inbox/steering + pre-step 瀑布（第 22-25 课）。
 */
import type { ChatMessage, LlmClient, ToolCall } from '@mini-dsh/llm'
import type { SessionLog } from '@mini-dsh/core-session'
import type { ToolRegistryService } from '@mini-dsh/core-tools'

// ---------- EventBus（waterfall） ----------

export type Listener = (...args: any[]) => unknown

export class EventBus {
  private readonly listeners = new Map<string, Listener[]>()

  on(kind: string, listener: Listener): () => void {
    const list = this.listeners.get(kind) ?? []
    list.push(listener)
    this.listeners.set(kind, list)
    return () => {
      const index = list.indexOf(listener)
      if (index >= 0) list.splice(index, 1)
    }
  }

  waterfall(kind: string, initial: unknown, ...args: unknown[]): unknown {
    let value = initial
    for (const listener of [...(this.listeners.get(kind) ?? [])]) {
      let delegated = false
      const next = (wrapped: unknown): void => {
        value = wrapped
        delegated = true
      }
      const result = listener(value, ...args, next)
      if (!delegated) return result
    }
    return value
  }
}

// ---------- Inbox ----------

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

  followup(content: string): UserMessage {
    const message = { id: this.nextId(), content }
    this.nextTurn.push(message)
    return message
  }

  steer(content: string): UserMessage {
    const message = { id: this.nextId(), content }
    this.nextStep.push(message)
    return message
  }

  inject(content: string): UserMessage {
    const message = { id: this.nextId(), content }
    this.nextStep.push(message)
    return message
  }

  claimNextTurn(): { turnInput?: UserMessage; stepInputs: UserMessage[] } {
    return { turnInput: this.nextTurn.shift(), stepInputs: this.nextStep.splice(0) }
  }

  claimNextStep(): UserMessage[] {
    return this.nextStep.splice(0)
  }

  get isEmpty(): boolean {
    return this.nextTurn.length === 0 && this.nextStep.length === 0
  }
}

// ---------- Agent ----------

export type AgentStatus = 'idle' | 'running'

export class Agent {
  readonly inbox = new Inbox()
  private _status: AgentStatus = 'idle'

  constructor(readonly id: string) {}

  get status(): AgentStatus {
    return this._status
  }

  followup(content: string): UserMessage {
    this._status = 'running'
    return this.inbox.followup(content)
  }

  steer(content: string): UserMessage {
    this._status = 'running'
    return this.inbox.steer(content)
  }

  inject(content: string): UserMessage {
    return this.inbox.inject(content)
  }

  settle(): void {
    this._status = 'idle'
  }
}

// ---------- StepRunner ----------

export interface StepContext {
  llm: LlmClient
  session: SessionLog
  tools: ToolRegistryService
}

export interface StepResult {
  messages: ChatMessage[]
  toolCalls: number
  finalContent: string
}

export class StepRunner {
  constructor(
    private readonly ctx: StepContext,
    private readonly turn: number,
    private readonly step: number,
  ) {}

  async run(messages: ChatMessage[]): Promise<StepResult> {
    const { session, llm, tools } = this.ctx
    session.append('step/start', { turn: this.turn, step: this.step })
    const reply = await llm.chat(messages)
    session.append('assistant/message', {
      turn: this.turn,
      step: this.step,
      message: { role: 'assistant', content: reply.content },
    })
    const next: ChatMessage[] = [...messages]
    if (reply.toolCalls.length > 0) {
      next.push({ role: 'assistant', content: reply.content, toolCalls: reply.toolCalls })
    }
    let toolCalls = 0
    for (const call of reply.toolCalls) {
      session.append('tool/call', {
        turn: this.turn,
        step: this.step,
        callId: call.id,
        name: call.name,
        arguments: call.arguments,
      })
      const content = await tools.execute(call.name, JSON.parse(call.arguments) as Record<string, unknown>)
      session.append('tool/result', {
        turn: this.turn,
        step: this.step,
        callId: call.id,
        message: { role: 'tool', content },
      })
      next.push({ role: 'tool', toolCallId: call.id, content })
      toolCalls += 1
    }
    session.append('step/end', { turn: this.turn, step: this.step })
    return { messages: next, toolCalls, finalContent: reply.content }
  }
}

// ---------- TurnRunner ----------

export interface TurnContext {
  llm: LlmClient
  session: SessionLog
  tools: ToolRegistryService
  maxSteps?: number
}

export interface TurnResult {
  turn: number
  steps: number
  reply: string
}

export class TurnRunner {
  private turnNumber = 0

  constructor(private readonly ctx: TurnContext) {}

  async run(prompt: string): Promise<TurnResult> {
    this.turnNumber += 1
    const turn = this.turnNumber
    const session = this.ctx.session
    const maxSteps = this.ctx.maxSteps ?? 5

    session.append('turn/start', { turn })
    if (!prompt.trim()) {
      session.append('turn/end', { turn, reason: 'completed' })
      return { turn, steps: 0, reply: '' }
    }

    let messages: ChatMessage[] = [{ role: 'user', content: prompt }]
    session.append('user/message', { turn, role: 'user', content: prompt })
    let steps = 0
    let reply = ''

    for (;;) {
      const step = new StepRunner(this.ctx, turn, steps + 1)
      const result = await step.run(messages)
      steps += 1
      messages = result.messages
      reply = result.finalContent
      if (result.toolCalls === 0) break
      if (steps >= maxSteps) throw new Error(`turn ${turn} 超过最大 step 数 ${maxSteps}`)
    }

    session.append('turn/end', { turn, reason: 'completed' })
    return { turn, steps, reply }
  }
}

// ---------- PreStepBus ----------

export interface PreStepPayload {
  messages: UserMessage[]
  turn: number
  step: number
}

export type PreStepDecision =
  | { kind: 'enter'; messages: UserMessage[] }
  | { kind: 'reject' }

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

  run(payload: PreStepPayload): PreStepDecision {
    const initial: PreStepDecision = { kind: 'enter', messages: payload.messages }
    return this.bus.waterfall('agent/pre-step', initial, payload) as PreStepDecision
  }
}

export type { ChatMessage, LlmClient, ToolCall }
