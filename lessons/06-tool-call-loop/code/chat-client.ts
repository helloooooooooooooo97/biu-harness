/**
 * ChatClient（v2）：返回带 tool_calls 的助手消息，并负责 wire 序列化。
 */
export interface ToolCall {
  id: string
  name: string
  /** 模型原样输出的参数 JSON 字符串。 */
  arguments: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string
  toolCalls?: ToolCall[]
  toolCallId?: string
}

export interface AssistantReply {
  content: string
  toolCalls: ToolCall[]
}

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

export class ChatClient {
  constructor(private readonly options: ChatClientOptions = {}) {}

  async chat(messages: ChatMessage[]): Promise<AssistantReply> {
    const key = this.options.apiKey ?? process.env.DEEPSEEK_API_KEY ?? ''
    if (!key) {
      if (process.env.MOCK_LLM === '1') {
        const last = messages.at(-1)
        return {
          content: `[mock] 我是内置 mock 回复。你说的是：${String(last?.content ?? '').slice(0, 60)}`,
          toolCalls: [],
        }
      }
      throw new Error('缺少 DEEPSEEK_API_KEY。设置环境变量，或使用 MOCK_LLM=1 走内置 mock。')
    }

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
