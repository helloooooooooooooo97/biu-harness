/**
 * DeepSeekAdapter：满足 LlmAdapter 接缝的真实实现。
 * 处理 reasoning_content（thinking）与流式 tool_calls 增量。
 */
import { SseParser } from './sse-parser.ts'
import type { LlmAdapter, Message, StreamChunk } from './llm.ts'

const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_MODEL = 'deepseek-chat'

export interface DeepSeekOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
  fetchImpl?: typeof fetch
}

function toWire(messages: Message[]): unknown[] {
  return messages.map((m) => {
    const text = m.content.filter((b) => b.type === 'text').map((b) => (b.type === 'text' ? b.text : '')).join('')
    const toolCalls = m.content
      .filter((b) => b.type === 'tool-call')
      .map((b) => (b.type === 'tool-call'
        ? { id: b.id, type: 'function', function: { name: b.name, arguments: b.arguments } }
        : null))
    const msg: Record<string, unknown> = { role: m.role, content: text }
    if (toolCalls.length) msg.tool_calls = toolCalls
    return msg
  })
}

export class DeepSeekAdapter implements LlmAdapter {
  readonly provider = 'deepseek'

  constructor(private readonly options: DeepSeekOptions = {}) {}

  async *stream(messages: Message[], opts: { signal?: AbortSignal } = {}): AsyncGenerator<StreamChunk> {
    const key = this.options.apiKey ?? process.env.DEEPSEEK_API_KEY
    if (!key) {
      if (process.env.MOCK_LLM === '1') {
        yield { type: 'text', text: '[mock] 流式回复' }
        yield { type: 'finish', reason: 'stop' }
        return
      }
      throw new Error('缺少 DEEPSEEK_API_KEY。')
    }
    if (opts.signal?.aborted) throw new DOMException('已中止', 'AbortError')

    const baseUrl = this.options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL
    const fetchImpl = this.options.fetchImpl ?? fetch
    const res = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: this.options.model ?? DEFAULT_MODEL,
        messages: toWire(messages),
        stream: true,
      }),
      signal: opts.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    if (!res.body) throw new Error('响应没有 body')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const parser = new SseParser()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        for (const event of parser.push(decoder.decode(value, { stream: true }))) {
          if (event.data === '[DONE]') return
          const json = JSON.parse(event.data) as {
            choices?: Array<{
              delta?: {
                content?: string
                reasoning_content?: string
                tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>
              }
              finish_reason?: string
            }>
          }
          const choice = json.choices?.[0]
          if (choice?.delta?.reasoning_content) yield { type: 'reasoning', text: choice.delta.reasoning_content }
          if (choice?.delta?.content) yield { type: 'text', text: choice.delta.content }
          for (const tc of choice?.delta?.tool_calls ?? []) {
            yield {
              type: 'tool-call-delta',
              id: tc.id ?? '',
              name: tc.function?.name,
              argumentsDelta: tc.function?.arguments ?? '',
            }
          }
          if (choice?.finish_reason) yield { type: 'finish', reason: choice.finish_reason }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
