/**
 * AgentLoop 驱动：只依赖接口（llm/sessions/tools），不 import 任何实现。
 */
import type { LlmClient, ChatMessage } from './llm.ts'
import type { SessionService } from './session.ts'
import type { ToolRegistryService } from './tools.ts'

export interface AgentLoopDeps {
  llm: LlmClient
  sessions: SessionService
  tools: ToolRegistryService
}

export interface AgentLoopDriver {
  run(input: string): Promise<{ reply: string; events: number }>
}

export class DefaultAgentLoop implements AgentLoopDriver {
  constructor(
    private readonly deps: AgentLoopDeps,
    private readonly sessionId = 'main',
  ) {}

  async run(input: string): Promise<{ reply: string; events: number }> {
    const session = this.deps.sessions.get(this.sessionId)
      ?? this.deps.sessions.create(this.sessionId)
    const messages: ChatMessage[] = [{ role: 'user', content: input }]
    session.append('user/message', { role: 'user', content: input })

    let reply = ''
    for (let step = 0; step < 3; step += 1) {
      const result = await this.deps.llm.chat(messages)
      session.append('assistant/message', { message: { role: 'assistant', content: result.content } })
      if (result.toolCalls.length === 0) {
        reply = result.content
        break
      }
      messages.push({ role: 'assistant', content: result.content, toolCalls: result.toolCalls })
      for (const call of result.toolCalls) {
        const content = await this.deps.tools.execute(call.name, JSON.parse(call.arguments) as Record<string, unknown>)
        session.append('tool/result', { callId: call.id, message: { role: 'tool', content } })
        messages.push({ role: 'tool', toolCallId: call.id, content })
      }
    }
    return { reply, events: session.events().length }
  }
}
