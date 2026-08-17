/**
 * llm-deepseek：真实 ChatClient + MockLlm（第 05/08/19 课）。
 * 注：真实 cordis 依赖在 36-40 课配置阶段接入，目前跑在 mini 内核上。
 */
import type { AssistantReply, ChatMessage, LlmClient, ToolCall } from '@mini-dsh/llm'

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

export interface ChatClientOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
  fetchImpl?: typeof fetch
}

/** 真实 DeepSeek 传输实现（Provider）。 */
export class ChatClient implements LlmClient {
  constructor(private readonly options: ChatClientOptions = {}) {}

  async chat(messages: ChatMessage[]): Promise<AssistantReply> {
    const key = this.options.apiKey ?? process.env.DEEPSEEK_API_KEY
    if (!key) throw new Error('缺少 DEEPSEEK_API_KEY。')
    const baseUrl = this.options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL
    const fetchImpl = this.options.fetchImpl ?? fetch
    const res = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: this.options.model ?? DEFAULT_MODEL,
        messages: toWire(messages),
        stream: false,
      }),
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

export interface Fixture {
  key: string
  content?: string
  toolCalls?: ToolCall[]
}

/** fixture 仓库：按 key 索引，同 key 按序消费。 */
export class FixtureStore {
  private readonly queue = new Map<string, Fixture[]>()

  constructor(fixtures: Fixture[] = []) {
    for (const fixture of fixtures) this.add(fixture)
  }

  add(fixture: Fixture): void {
    const list = this.queue.get(fixture.key) ?? []
    list.push(fixture)
    this.queue.set(fixture.key, list)
  }

  take(key: string): Fixture | undefined {
    const list = this.queue.get(key)
    if (!list?.length) return undefined
    const fixture = list.shift()
    if (list.length === 0) this.queue.delete(key)
    return fixture
  }
}

export function keyOf(messages: ChatMessage[]): string {
  return [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
}

/** MockLlm：fixture 录放实现（Provider）。 */
export class MockLlm implements LlmClient {
  constructor(
    private readonly store: FixtureStore,
    private readonly fallback?: string,
  ) {}

  async chat(messages: ChatMessage[]): Promise<AssistantReply> {
    const key = keyOf(messages)
    const fixture = this.store.take(key)
    if (!fixture) {
      if (this.fallback != null) return { content: this.fallback, toolCalls: [] }
      throw new Error(`mock 未命中: ${key}`)
    }
    return { content: fixture.content ?? '', toolCalls: fixture.toolCalls ?? [] }
  }
}
