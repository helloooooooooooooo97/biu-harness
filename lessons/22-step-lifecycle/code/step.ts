/**
 * StepRunner：一个 step = 一次模型请求 + 它的工具执行，全过程写 durable 事件。
 */
import type { ChatMessage, LlmClient } from './llm.ts'
import type { SessionLog } from './session.ts'
import type { ToolRegistryService } from './tools.ts'

export interface StepContext {
  llm: LlmClient
  session: SessionLog
  tools: ToolRegistryService
}

export interface StepResult {
  /** 本 step 结束后的完整消息数组（供下一个 step 继续）。 */
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
