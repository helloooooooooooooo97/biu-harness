/**
 * AgentV1：最小 agent loop（输入 → 模型请求 → 回复）。
 */
import { ChatClient, type ChatMessage } from './chat-client.ts'

export interface AgentOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
  fetchImpl?: typeof fetch
}

export interface RunResult {
  messages: ChatMessage[]
  reply: string
}

export class AgentV1 {
  private readonly chatClient: ChatClient

  constructor(private readonly options: AgentOptions = {}) {
    this.chatClient = new ChatClient(options)
  }

  /** 跑一个最小回合：user prompt → 模型回复。返回完整 messages 与 reply。 */
  async run(prompt: string, history: ChatMessage[] = []): Promise<RunResult> {
    const messages: ChatMessage[] = [...history, { role: 'user', content: prompt }]
    const reply = await this.chatClient.chat(messages)
    return { messages: [...messages, { role: 'assistant', content: reply }], reply }
  }
}
