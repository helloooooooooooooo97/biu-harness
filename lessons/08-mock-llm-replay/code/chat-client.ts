/** ChatClient：真实 DeepSeek 实现（Provider）。 */
import type { LlmClient } from './llm.ts'
import type { AssistantReply, ChatMessage } from './types.ts'

export interface ChatClientOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_MODEL = 'deepseek-chat'

/** 把内部消息转成 API wire 格式。 */
export function toWire(messages: ChatMessage[]): unknown[] {
  return messages.map((m) => {
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content ?? '',
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        })),
      }
    }
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId, content: m.content ?? '' }
    }
    return { role: m.role, content: m.content ?? '' }
  })
}

export class ChatClient implements LlmClient {
  constructor(private readonly options: ChatClientOptions = {}) {}

  async chat(messages: ChatMessage[]): Promise<AssistantReply> {
    const key = this.options.apiKey ?? process.env.DEEPSEEK_API_KEY
    if (!key) throw new Error('缺少 DEEPSEEK_API_KEY。')

    const baseUrl = this.options.baseUrl
      ?? process.env.DEEPSEEK_BASE_URL
      ?? DEFAULT_BASE_URL
    const fetchImpl = this.options.fetchImpl ?? fetch
    const res = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: this.options.model ?? DEFAULT_MODEL,
        messages: toWire(messages),
        stream: false,
      }),
      signal: this.options.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    const data = await res.json() as {
      choices?: Array<{ message?: {
        content?: string
        tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>
      } }>
    }
    const msg = data.choices?.[0]?.message
    return {
      content: msg?.content ?? '',
      toolCalls: (msg?.tool_calls ?? []).map((tc) => ({
        id: tc.id ?? '',
        name: tc.function?.name ?? '',
        arguments: tc.function?.arguments ?? '',
      })),
    }
  }
}
