import { Service, type Context } from 'cordis'
import '../../types.ts'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatProvider = 'deepseek' | 'openai'

interface ChatConfig {
  provider: ChatProvider
  apiKey: string
  model: string
  systemPrompt: string
}

function defaults(): ChatConfig {
  const deepseek = Boolean(process.env.DEEPSEEK_API_KEY)
  return {
    provider: deepseek || !process.env.OPENAI_API_KEY ? 'deepseek' : 'openai',
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
    model: process.env.CHAT_MODEL || (deepseek || !process.env.OPENAI_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini'),
    systemPrompt: '你是 hmr-dev 控制台里的助手，回答简洁。',
  }
}

function hint(key: string) {
  if (!key) return ''
  if (key.length <= 8) return '已配置'
  return `${key.slice(0, 3)}…${key.slice(-4)}`
}

export class ChatService extends Service {
  private config = defaults()

  constructor(ctx: Context) {
    super(ctx, 'chat')
  }

  publicView() {
    return {
      provider: this.config.provider,
      model: this.config.model,
      systemPrompt: this.config.systemPrompt,
      configured: Boolean(this.config.apiKey),
      hint: hint(this.config.apiKey),
    }
  }

  patch(next: Partial<{ provider: ChatProvider; apiKey: string; model: string; systemPrompt: string }>) {
    if (next.provider) this.config.provider = next.provider
    if (typeof next.model === 'string' && next.model.trim()) this.config.model = next.model.trim()
    if (typeof next.systemPrompt === 'string') this.config.systemPrompt = next.systemPrompt
    if (typeof next.apiKey === 'string' && next.apiKey.trim()) this.config.apiKey = next.apiKey.trim()
    return this.publicView()
  }

  async complete(messages: ChatMessage[]) {
    const last = messages.filter((item) => item.role === 'user').at(-1)?.content?.trim() ?? ''
    if (!last) return '请先输入内容。'
    if (!this.config.apiKey) {
      return `未配置 API Key，本地回声：${last}`
    }
    const url =
      this.config.provider === 'deepseek'
        ? 'https://api.deepseek.com/chat/completions'
        : 'https://api.openai.com/v1/chat/completions'
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'system', content: this.config.systemPrompt }, ...messages],
      }),
    })
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
    if (!res.ok) throw new Error(data.error?.message || `chat http ${res.status}`)
    return data.choices?.[0]?.message?.content?.trim() || '（空回复）'
  }
}

export const name = 'chat'
export const inject = ['http', 'hub']

export function apply(ctx: Context) {
  const chat = new ChatService(ctx)
  ctx.hub.register({
    id: 'chat',
    title: '对话',
    subtitle: 'POST /api/chat',
    plugin: 'chat',
    kind: 'chat',
  })

  ctx.http.route('GET', '/api/chat/config', (route) => {
    route.send(200, chat.publicView())
  })
  ctx.http.route('POST', '/api/chat/config', async (route) => {
    const payload = (await route.json()) as Partial<{
      provider: ChatProvider
      apiKey: string
      model: string
      systemPrompt: string
    }>
    route.send(200, chat.patch(payload ?? {}))
  })
  ctx.http.route('POST', '/api/chat', async (route) => {
    const payload = (await route.json()) as { messages?: ChatMessage[] }
    const messages = Array.isArray(payload?.messages) ? payload.messages : []
    try {
      route.send(200, { text: await chat.complete(messages) })
    } catch (error) {
      route.send(500, { error: String(error) })
    }
  })
}
