/**
 * ChatClient：负责与 OpenAI 兼容的 /chat/completions 接口对话。
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
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

export class ChatClient {
  constructor(private readonly options: ChatClientOptions = {}) {}

  /** 调一次 chat/completions，返回助手消息文本。 */
  async chat(messages: ChatMessage[]): Promise<string> {
    const key = this.options.apiKey ?? process.env.DEEPSEEK_API_KEY ?? ''
    if (!key) {
      if (process.env.MOCK_LLM === '1') {
        const last = messages.at(-1)
        return `[mock] 我是内置 mock 回复。你说的是：${String(last?.content ?? '').slice(0, 60)}`
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
        messages,
        stream: false,
      }),
      signal: this.options.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return data.choices?.[0]?.message?.content ?? ''
  }
}
