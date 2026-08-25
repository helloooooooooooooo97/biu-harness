import { Service, type Context } from 'cordis'

export type ChatProvider = 'deepseek' | 'openai' | 'anthropic'

export interface LlmConfig {
  provider: ChatProvider
  apiKey: string
  model: string
}

export interface LlmMessage {
  role: string
  content?: string | null
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

/** OpenAI/DeepSeek：带 tool_calls 时 content 宜为 null，空字符串可能导致后续回合拒答。 */
export function assistantContentForApi(text: string | undefined | null, hasToolCalls: boolean): string | null {
  if (hasToolCalls && !text) return null
  return text ?? null
}

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

/** 对标 dsh：挂在 assistant/message 上的 provider usage（瘦字段）。 */
export interface LlmUsage {
  inputTokens: number
  outputTokens: number
  totalTokens?: number
  cacheReadTokens?: number
}

export interface AssistantReply {
  content: string | null
  toolCalls: ToolCall[]
  usage?: LlmUsage
}

export interface ChatOptions {
  /** 文本 delta；agent-loop 用来即时 append `assistant/chunk`。 */
  onDelta?: (text: string) => void | Promise<void>
}

export interface LlmClient {
  chat(
    messages: LlmMessage[],
    tools?: unknown[],
    signal?: AbortSignal,
    options?: ChatOptions,
  ): Promise<AssistantReply>
}

export function parseProviderUsage(raw: unknown): LlmUsage | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const u = raw as Record<string, unknown>
  const input = num(u.prompt_tokens ?? u.input_tokens ?? u.inputTokens)
  const output = num(u.completion_tokens ?? u.output_tokens ?? u.outputTokens)
  if (input == null && output == null) return undefined
  const total = num(u.total_tokens ?? u.totalTokens)
  const cacheRead = num(
    u.prompt_cache_hit_tokens ?? u.cache_read_input_tokens ?? u.cacheReadTokens,
  )
  return {
    inputTokens: input ?? 0,
    outputTokens: output ?? 0,
    ...(total != null ? { totalTokens: total } : {}),
    ...(cacheRead != null ? { cacheReadTokens: cacheRead } : {}),
  }
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

export function formatUsage(usage: LlmUsage | undefined): string {
  if (!usage) return ''
  const parts = [`${usage.inputTokens}→${usage.outputTokens}`]
  if (usage.cacheReadTokens) parts.push(`cache ${usage.cacheReadTokens}`)
  return parts.join(' · ')
}

interface StreamToolAcc {
  id: string
  name: string
  arguments: string
}

/** 解析 OpenAI/DeepSeek chat.completions SSE；`[DONE]` 结束。不引入 eventsource-parser。 */
export async function consumeChatCompletionSse(
  stream: ReadableStream<Uint8Array>,
  options: {
    onDelta?: (text: string) => void | Promise<void>
    signal?: AbortSignal
  } = {},
): Promise<AssistantReply> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let usage: LlmUsage | undefined
  const tools = new Map<number, StreamToolAcc>()
  let sawDone = false

  const onAbort = () => {
    void reader.cancel().catch(() => undefined)
  }
  options.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    while (true) {
      if (options.signal?.aborted) throw new Error('cancelled')
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const payload = sseDataLine(line)
        if (payload === undefined) continue
        if (payload === '[DONE]') {
          sawDone = true
          break
        }
        let chunk: {
          choices?: Array<{
            delta?: {
              content?: string | null
              tool_calls?: Array<{
                index?: number
                id?: string
                function?: { name?: string; arguments?: string }
              }>
            }
          }>
          usage?: unknown
          error?: { message?: string }
        }
        try {
          chunk = JSON.parse(payload) as typeof chunk
        } catch {
          continue
        }
        if (chunk.error?.message) throw new Error(chunk.error.message)
        const delta = chunk.choices?.[0]?.delta
        const text = delta?.content
        if (typeof text === 'string' && text.length) {
          content += text
          await options.onDelta?.(text)
        }
        for (const call of delta?.tool_calls ?? []) {
          const index = typeof call.index === 'number' ? call.index : 0
          const acc = tools.get(index) ?? { id: '', name: '', arguments: '' }
          if (call.id) acc.id = call.id
          if (call.function?.name) acc.name = call.function.name
          if (typeof call.function?.arguments === 'string') acc.arguments += call.function.arguments
          tools.set(index, acc)
        }
        const nextUsage = parseProviderUsage(chunk.usage)
        if (nextUsage) usage = nextUsage
      }
      if (sawDone) break
    }
  } finally {
    options.signal?.removeEventListener('abort', onAbort)
    reader.releaseLock()
  }

  if (options.signal?.aborted) throw new Error('cancelled')

  const toolCalls: ToolCall[] = [...tools.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, call]) => ({
      id: call.id || `call_${Math.random().toString(36).slice(2, 10)}`,
      name: call.name,
      arguments: call.arguments || '{}',
    }))
    .filter((call) => call.name)

  return {
    content: content || null,
    toolCalls,
    ...(usage ? { usage } : {}),
  }
}

function sseDataLine(line: string): string | undefined {
  if (!line.startsWith('data:')) return undefined
  return line.slice(5).replace(/^ /, '')
}

export class OpenAiCompatLlm implements LlmClient {
  constructor(private config: LlmConfig) {}

  async chat(
    messages: LlmMessage[],
    tools: unknown[] = [],
    signal?: AbortSignal,
    options?: ChatOptions,
  ): Promise<AssistantReply> {
    const url =
      this.config.provider === 'deepseek'
        ? 'https://api.deepseek.com/chat/completions'
        : 'https://api.openai.com/v1/chat/completions'
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    }
    if (tools.length) {
      body.tools = tools
      body.tool_choice = 'auto'
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) {
      let detail = `llm http ${res.status}`
      try {
        const err = (await res.json()) as { error?: { message?: string } }
        if (err.error?.message) detail = err.error.message
      } catch {
        /* ignore */
      }
      throw new Error(detail)
    }
    if (!res.body) throw new Error('llm stream missing body')
    return consumeChatCompletionSse(res.body, { onDelta: options?.onDelta, signal })
  }
}

/**
 * Anthropic Messages API（/v1/messages，SSE）。请求体与事件格式均不同于 OpenAI 兼容接口：
 *  - 鉴权用 `x-api-key` + `anthropic-version` 头，不带 `authorization: Bearer`；
 *  - 顶层字段 `system`（字符串，放 system 消息）、`max_tokens`；
 *  - 工具参数通过 `content_block_delta` 里的 `input_json_delta.partial_json` 增量累积；
 *  - 结束由 `message_stop` 标志，无 `[DONE]`。
 */
export class AnthropicLlm implements LlmClient {
  private endpoint = 'https://api.anthropic.com/v1/messages'

  constructor(private config: LlmConfig) {}

  async chat(
    messages: LlmMessage[],
    tools: unknown[] = [],
    signal?: AbortSignal,
    options?: ChatOptions,
  ): Promise<AssistantReply> {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content ?? '')
      .filter((c) => c)
      .join('\n\n')
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: 4096,
      ...(system ? { system } : {}),
      messages: messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role,
          ...(m.content ? { content: m.content } : {}),
          ...(m.tool_call_id
            ? {
                content: [
                  { type: 'tool_result' as const, tool_use_id: m.tool_call_id, content: m.content ?? '' },
                ],
              }
            : {}),
          ...(m.tool_calls?.length
            ? {
                content: m.tool_calls.map((call) => ({
                  type: 'tool_use' as const,
                  id: call.id,
                  name: call.function.name,
                  input: parseToolJson(call.function.arguments),
                })),
              }
            : {}),
        })),
      stream: true,
    }
    if (tools.length) {
      body.tools = tools.map((item) => {
        const fn = (item as { function?: { name: string; description?: string; parameters?: unknown } })
          .function
        return {
          name: fn?.name ?? 'unknown',
          description: fn?.description ?? '',
          input_schema: (fn?.parameters as Record<string, unknown>) ?? { type: 'object', properties: {} },
        }
      })
    }
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) {
      let detail = `llm http ${res.status}`
      try {
        const err = (await res.json()) as { error?: { message?: string } }
        if (err.error?.message) detail = err.error.message
      } catch {
        /* ignore */
      }
      throw new Error(detail)
    }
    if (!res.body) throw new Error('llm stream missing body')
    return consumeMessagesSse(res.body, { onDelta: options?.onDelta, signal })
  }
}

function parseToolJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    // 返回暂存原串，避免构造请求直接抛出
    return { _raw: text }
  }
}

/** 解析 Anthropic Messages SSE：text（text_delta）+ 工具参数（input_json_delta）累积。 */
async function consumeMessagesSse(
  stream: ReadableStream<Uint8Array>,
  options: { onDelta?: (text: string) => void | Promise<void>; signal?: AbortSignal } = {},
): Promise<AssistantReply> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let usage: LlmUsage | undefined
  const toolBlocks: Array<{ id?: string; name?: string; input: string }> = []
  let sawStop = false

  const onAbort = () => void reader.cancel().catch(() => undefined)
  options.signal?.addEventListener('abort', onAbort, { once: true })

  try {
    while (true) {
      if (options.signal?.aborted) throw new Error('cancelled')
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const payloadLine = line.slice(5).trim()
        if (!payloadLine) continue
        let evt: Record<string, unknown>
        try {
          evt = JSON.parse(payloadLine) as Record<string, unknown>
        } catch {
          continue
        }
        switch (evt.type) {
          case 'message_start': {
            const message = evt.message as { usage?: unknown } | undefined
            const nextUsage = parseProviderUsage(message?.usage)
            if (nextUsage) usage = nextUsage
            break
          }
          case 'message_delta': {
            const nextUsage = parseProviderUsage(evt.usage)
            if (nextUsage) usage = nextUsage
            break
          }
          case 'content_block_start': {
            const block = evt.content_block as { type?: string; id?: string; name?: string } | undefined
            if (block?.type === 'tool_use') {
              toolBlocks.push({ id: block.id, name: block.name, input: '' })
            }
            break
          }
          case 'content_block_delta': {
            const delta = evt.delta as { type?: string; text?: string; partial_json?: string } | undefined
            if (delta?.type === 'text_delta' && typeof delta.text === 'string' && delta.text.length) {
              content += delta.text
              await options.onDelta?.(delta.text)
            } else if (delta?.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
              const last = toolBlocks[toolBlocks.length - 1]
              if (last) last.input += delta.partial_json
            }
            break
          }
          case 'message_stop':
            sawStop = true
            break
        }
      }
      if (sawStop) break
    }
  } finally {
    options.signal?.removeEventListener('abort', onAbort)
    reader.releaseLock()
  }

  if (options.signal?.aborted) throw new Error('cancelled')

  const toolCalls: ToolCall[] = toolBlocks
    .filter((block) => block.name)
    .map((block) => ({
      id: block.id || `call_${Math.random().toString(36).slice(2, 10)}`,
      name: block.name ?? '',
      arguments: block.input.trim() || '{}',
    }))

  return {
    content: content || null,
    toolCalls,
    ...(usage ? { usage } : {}),
  }
}

export class LlmService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'llm')
  }

  forConfig(config: LlmConfig): LlmClient {
    const ctx = this.ctx
    const client =
      config.provider === 'anthropic'
        ? new AnthropicLlm(config)
        : new OpenAiCompatLlm(config)
    return {
      chat: async (messages, tools = [], signal, options) => {
        ctx.emit('llm/request', { model: config.model, provider: config.provider })
        const reply = await client.chat(messages, tools, signal, {
          onDelta: async (text) => {
            ctx.emit('llm/stream', { text })
            await options?.onDelta?.(text)
          },
        })
        return reply
      },
    }
  }
}

export const name = 'llm'
export const inject = [] as const

export function apply(ctx: Context) {
  new LlmService(ctx)
}
