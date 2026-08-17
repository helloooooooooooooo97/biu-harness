/**
 * AgentV3：流式 agent（边收边累计，记录 stopReason）。
 */
import { ChatClient, type ChatMessage, type StreamingLlmClient, type StreamChatOptions } from './chat-client.ts'

export interface AgentV3Options {
  apiKey?: string
  baseUrl?: string
  model?: string
  fetchImpl?: typeof fetch
  client?: StreamingLlmClient
}

export interface RunResult {
  reply: string
  chunks: number
  stopReason: string
}

export class AgentV3 {
  private readonly client: StreamingLlmClient

  constructor(private readonly options: AgentV3Options = {}) {
    this.client = options.client ?? new ChatClient(options)
  }

  async run(prompt: string, streamOptions: StreamChatOptions = {}): Promise<RunResult> {
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }]
    let reply = ''
    let chunks = 0
    let stopReason = 'stop'
    for await (const event of this.client.streamChat(messages, streamOptions)) {
      if (event.type === 'text') {
        reply += event.text
        chunks += 1
      } else {
        stopReason = event.reason
      }
    }
    return { reply, chunks, stopReason }
  }
}
