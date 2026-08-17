/**
 * TurnRunner：turn = step 的容器。
 * turn/start 先开（空回合也记录）→ user/message → step* → turn/end。
 */
import type { ChatMessage, LlmClient } from './llm.ts'
import type { SessionLog } from './session.ts'
import type { ToolRegistryService } from './tools.ts'
import { StepRunner } from './step.ts'

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
      // 空输入：0 个 step 的回合，也要记录这次尝试。
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
