/**
 * AgentV2：工具调用循环（解析 → 执行 → 回填 → 再请求）。
 */
import { ChatClient, type ChatMessage, type ToolCall } from './chat-client.ts'
import { ToolRegistry } from './tool-registry.ts'
import type { Tool } from './tool.ts'

export interface AgentV2Options {
  apiKey?: string
  baseUrl?: string
  model?: string
  fetchImpl?: typeof fetch
  tools?: Tool[]
  maxSteps?: number
}

export interface RunResult {
  messages: ChatMessage[]
  steps: number
}

export class AgentV2 {
  private readonly chatClient: ChatClient
  private readonly tools: ToolRegistry
  private readonly maxSteps: number

  constructor(private readonly options: AgentV2Options = {}) {
    this.chatClient = new ChatClient(options)
    this.tools = new ToolRegistry()
    for (const tool of options.tools ?? []) this.tools.register(tool)
    this.maxSteps = options.maxSteps ?? 5
  }

  async run(prompt: string): Promise<RunResult> {
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }]
    for (let step = 0; step < this.maxSteps; step += 1) {
      const reply = await this.chatClient.chat(messages)
      if (!reply.toolCalls.length) {
        messages.push({ role: 'assistant', content: reply.content })
        return { messages, steps: step + 1 }
      }
      messages.push({ role: 'assistant', content: reply.content, toolCalls: reply.toolCalls })
      for (const call of reply.toolCalls) {
        messages.push({ role: 'tool', toolCallId: call.id, content: await this.executeTool(call) })
      }
    }
    throw new Error(`超过最大 step 数 ${this.maxSteps}`)
  }

  private async executeTool(call: ToolCall): Promise<string> {
    let args: Record<string, unknown>
    try {
      args = JSON.parse(call.arguments) as Record<string, unknown>
    } catch {
      return `错误: 参数无法解析（不是合法 JSON）: ${call.arguments}`
    }
    try {
      return await this.tools.execute(call.name, args)
    } catch (err) {
      return `错误: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}
