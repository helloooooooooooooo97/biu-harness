/**
 * ChatClient（v3）：SSE 流式接口 + finish_reason + AbortSignal。
 */
import { SseParser } from './sse-parser.ts'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'finish'; reason: string }

export interface StreamingLlmClient {
  streamChat(messages: ChatMessage[], options?: StreamChatOptions): AsyncGenerator<StreamEvent>
}

export interface StreamChatOptions {
  signal?: AbortSignal
}

export interface ChatClientOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
  fetchImpl?: typeof fetch
}

const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_MODEL = 'deepseek-chat'

export class ChatClient implements StreamingLlmClient {
  constructor(private readonly options: ChatClientOptions = {}) { }

  async *streamChat(messages: ChatMessage[], options: StreamChatOptions = {}): AsyncGenerator<StreamEvent> {
    const key = this.options.apiKey ?? process.env.DEEPSEEK_API_KEY ?? ''
    if (!key) {
      if (process.env.MOCK_LLM === '1') {
        yield { type: 'text', text: `[mock] 流式回复：${String(messages.at(-1)?.content ?? '').slice(0, 40)}` }
        yield { type: 'finish', reason: 'stop' }
        return
      }
      throw new Error('缺少 DEEPSEEK_API_KEY。设置环境变量，或使用 MOCK_LLM=1 走内置 mock。')
    }
    if (options.signal?.aborted) throw new DOMException('已中止', 'AbortError')

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
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      }),
      signal: options.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    if (!res.body) throw new Error('响应没有 body，无法流式读取')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const parser = new SseParser()
    try {
      for (; ;) {
        const { done, value } = await reader.read()
        if (done) break
        // 这里表示的是当parser能切出来一个新的完整的SSE事件时，就会触发这个for循环
        for (const event of parser.push(decoder.decode(value, { stream: true }))) {
          const { events, done: finished } = this.consume(event)
          for (const e of events) yield e
          if (finished) return
        }
      }
      for (const event of parser.flush()) {
        const { events, done: finished } = this.consume(event)
        for (const e of events) yield e
        if (finished) return
      }
    } finally {
      reader.releaseLock()
    }
  }

  /** 消费一条 SSE 事件；done 表示流已正常结束（[DONE]）。 */
  private consume(event: { data: string }): { events: StreamEvent[]; done: boolean } {
    if (event.data === '[DONE]') return { events: [], done: true }
    const json = JSON.parse(event.data) as {
      choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>
    }
    const choice = json.choices?.[0]
    const events: StreamEvent[] = []
    if (choice?.delta?.content) events.push({ type: 'text', text: choice.delta.content })
    if (choice?.finish_reason) events.push({ type: 'finish', reason: choice.finish_reason })
    return { events, done: false }
  }
}
