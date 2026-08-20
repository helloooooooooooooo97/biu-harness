import { Service, type Context } from 'cordis'
import '../../types.ts'

export interface LlmConfig {
  provider: 'deepseek' | 'openai'
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

export interface LlmClient {
  chat(messages: LlmMessage[], tools: unknown[], signal?: AbortSignal): Promise<AssistantReply>
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

export class OpenAiCompatLlm implements LlmClient {
  constructor(private config: LlmConfig) {}

  async chat(messages: LlmMessage[], tools: unknown[], signal?: AbortSignal): Promise<AssistantReply> {
    const url =
      this.config.provider === 'deepseek'
        ? 'https://api.deepseek.com/chat/completions'
        : 'https://api.openai.com/v1/chat/completions'
    const body: Record<string, unknown> = { model: this.config.model, messages }
    if (tools.length) {
      body.tools = tools
      body.tool_choice = 'auto'
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    })
    const data = (await res.json()) as {
      choices?: Array<{ message?: LlmMessage }>
      usage?: unknown
      error?: { message?: string }
    }
    if (!res.ok) throw new Error(data.error?.message || `llm http ${res.status}`)
    const message = data.choices?.[0]?.message
    this.ctxEmitChunk(message?.content)
    return {
      content: message?.content ?? null,
      toolCalls: (message?.tool_calls ?? []).map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments,
      })),
      usage: parseProviderUsage(data.usage),
    }
  }

  private ctxEmitChunk(_text: string | null | undefined) {}
}

export class LlmService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'llm')
  }

  forConfig(config: LlmConfig): LlmClient {
    const ctx = this.ctx
    const client = new OpenAiCompatLlm(config)
    return {
      chat: async (messages, tools, signal) => {
        ctx.emit('llm/request', { model: config.model })
        const reply = await client.chat(messages, tools, signal)
        if (reply.content) ctx.emit('llm/stream', { text: reply.content })
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
