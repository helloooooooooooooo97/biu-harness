import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Service, type Context } from 'cordis'
import '../../types.ts'
import type { ChatMessage } from './chat-types.ts'
import type { AgentToolMode } from '../registry/tools.ts'

export type { ChatMessage }

export type ChatProvider = 'deepseek' | 'openai'
export type { AgentToolMode }

interface ChatConfig {
  provider: ChatProvider
  apiKey: string
  model: string
  systemPrompt: string
  agentMode: AgentToolMode
}

function configPath() {
  return join(process.cwd(), '.cordis', 'chat-config.json')
}

function defaults(): ChatConfig {
  const deepseek = Boolean(process.env.DEEPSEEK_API_KEY)
  return {
    provider: deepseek || !process.env.OPENAI_API_KEY ? 'deepseek' : 'openai',
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
    model: process.env.CHAT_MODEL || (deepseek || !process.env.OPENAI_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini'),
    systemPrompt: '你是控制台里的助手。需要时调用当前已注册的 tools；插件卸载后对应 tool 会消失。回答简洁。',
    agentMode: 'standard',
  }
}

function hint(key: string) {
  if (!key) return ''
  if (key.length <= 8) return '已配置'
  return `${key.slice(0, 3)}…${key.slice(-4)}`
}

function readPersisted(): Partial<ChatConfig> | null {
  try {
    return JSON.parse(readFileSync(configPath(), 'utf8')) as Partial<ChatConfig>
  } catch {
    return null
  }
}

function writePersisted(config: ChatConfig) {
  const dir = join(process.cwd(), '.cordis')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    configPath(),
    `${JSON.stringify(
      {
        provider: config.provider,
        model: config.model,
        systemPrompt: config.systemPrompt,
        agentMode: config.agentMode,
        apiKey: config.apiKey,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
}

function parseAgentMode(value: unknown, fallback: AgentToolMode): AgentToolMode {
  return value === 'minimal' || value === 'standard' ? value : fallback
}

function mergePersisted(base: ChatConfig, saved: Partial<ChatConfig> | null): ChatConfig {
  if (!saved) return base
  const envKey = Boolean(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY)
  return {
    provider: saved.provider === 'openai' || saved.provider === 'deepseek' ? saved.provider : base.provider,
    model: !process.env.CHAT_MODEL && typeof saved.model === 'string' && saved.model.trim() ? saved.model.trim() : base.model,
    systemPrompt: typeof saved.systemPrompt === 'string' ? saved.systemPrompt : base.systemPrompt,
    agentMode: parseAgentMode(saved.agentMode, base.agentMode),
    apiKey: !envKey && typeof saved.apiKey === 'string' && saved.apiKey.trim() ? saved.apiKey.trim() : base.apiKey,
  }
}

export class ChatService extends Service {
  private config = mergePersisted(defaults(), readPersisted())

  constructor(ctx: Context) {
    super(ctx, 'chat')
    ctx.systemPrompt.register('chat.persona', () => this.config.systemPrompt)
    this.syncLlm()
    this.syncToolsMode()
  }

  publicView() {
    return {
      provider: this.config.provider,
      model: this.config.model,
      systemPrompt: this.config.systemPrompt,
      agentMode: this.config.agentMode,
      configured: Boolean(this.config.apiKey),
      hint: hint(this.config.apiKey),
      tools: this.ctx.tools.names(),
    }
  }

  patch(
    next: Partial<{
      provider: ChatProvider
      apiKey: string
      model: string
      systemPrompt: string
      agentMode: AgentToolMode
    }>,
    opts?: { persist?: boolean },
  ) {
    if (next.provider) this.config.provider = next.provider
    if (typeof next.model === 'string' && next.model.trim()) this.config.model = next.model.trim()
    if (typeof next.systemPrompt === 'string') this.config.systemPrompt = next.systemPrompt
    if (typeof next.apiKey === 'string' && next.apiKey.trim()) this.config.apiKey = next.apiKey.trim()
    if (next.agentMode === 'standard' || next.agentMode === 'minimal') this.config.agentMode = next.agentMode
    this.syncLlm()
    this.syncToolsMode()
    if (opts?.persist !== false) {
      try {
        writePersisted(this.config)
      } catch (error) {
        console.warn('[chat] failed to persist config', error)
      }
    }
    return this.publicView()
  }

  async complete(messages: ChatMessage[], sessionId?: string) {
    this.syncLlm()
    this.syncToolsMode()
    const last = messages.filter((item) => item.role === 'user').at(-1)?.content?.trim() ?? ''
    const agent = await this.ctx.agents.create(sessionId)
    const result = await agent.send(last)
    return { text: result.text, sessionId: agent.sessionId, steps: result.steps }
  }

  private syncLlm() {
    this.ctx.agents.configure({
      provider: this.config.provider,
      apiKey: this.config.apiKey,
      model: this.config.model,
    })
  }

  private syncToolsMode() {
    this.ctx.tools.setMode(this.config.agentMode)
  }
}

export const name = 'chat'
export const inject = ['http', 'hub', 'agents', 'sessions', 'systemPrompt', 'tools']

export function apply(ctx: Context) {
  const chat = new ChatService(ctx)
  ctx.hub.register({
    id: 'chat',
    title: '对话',
    subtitle: 'session + ctx.agents',
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
      agentMode: AgentToolMode
    }>
    route.send(200, chat.patch(payload ?? {}))
  })
  ctx.http.route('POST', '/api/sessions', async (route) => {
    const record = await ctx.sessions.create()
    route.send(201, { id: record.id, version: record.version })
  })
  ctx.http.route('GET', '/api/sessions', async (route) => {
    const ids = await ctx.sessions.list()
    const items = []
    for (const id of ids) {
      const record = await ctx.sessions.get(id)
      if (!record) continue
      const users = record.events.filter((event) => event.type === 'user/message')
      const lastUser = users.at(-1)
      const title =
        lastUser && 'text' in lastUser && typeof lastUser.text === 'string'
          ? lastUser.text.slice(0, 48) || id.slice(0, 8)
          : id.slice(0, 8)
      items.push({
        id,
        version: record.version,
        eventCount: record.events.length,
        title,
        updatedAt: record.events.at(-1)?.ts ?? 0,
        ...(record.project ? { project: record.project } : {}),
      })
    }
    items.sort((a, b) => b.updatedAt - a.updatedAt)
    route.send(200, { sessions: items })
  })
  ctx.http.route('GET', '/api/sessions/:id', async (route) => {
    const record = await ctx.sessions.get(route.params.id)
    if (!record) return route.send(404, { error: 'unknown session' })
    route.send(200, {
      id: record.id,
      version: record.version,
      events: record.events,
      messages: ctx.sessions.deriveMessages(record.id),
      ...(record.project ? { project: record.project } : {}),
    })
  })
  ctx.http.route('PUT', '/api/sessions/:id/project', async (route) => {
    const payload = (await route.json()) as { path?: string | null; name?: string | null }
    try {
      // path 优先；兼容旧客户端误传 name=null 解绑
      const rawPath = payload.path !== undefined ? payload.path : payload.name
      if (rawPath == null || rawPath === '') {
        await ctx.sessions.setProject(route.params.id, null)
        return route.send(200, { ok: true, project: null })
      }
      const project = await ctx.sessions.setProject(route.params.id, { path: String(rawPath) })
      route.send(200, { ok: true, project })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })
  ctx.http.route('POST', '/api/sessions/:id/fork', async (route) => {
    try {
      const child = await ctx.sessions.fork(route.params.id)
      route.send(201, { id: child.id, version: child.version, parentId: route.params.id })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })
  ctx.http.route('DELETE', '/api/sessions/:id', async (route) => {
    const id = route.params.id
    ctx.agents.get(id)?.dispose()
    const ok = await ctx.sessions.delete(id)
    if (!ok) return route.send(404, { error: 'unknown session' })
    route.send(200, { ok: true, id })
  })
  ctx.http.route('POST', '/api/sessions/:id/messages', async (route) => {
    const payload = (await route.json()) as { text?: string; kind?: 'wake' | 'inject' }
    const agent = await ctx.agents.create(route.params.id)
    // re-sync in-memory LLM without rewriting disk
    chat.patch({}, { persist: false })
    if (payload.kind === 'inject') {
      agent.inject(payload.text ?? '')
      return route.send(200, { sessionId: agent.sessionId, queued: true })
    }
    try {
      const turn = await agent.send(payload.text ?? '')
      route.send(200, { sessionId: agent.sessionId, text: turn.text, steps: turn.steps })
    } catch (error) {
      route.send(500, { error: String(error) })
    }
  })
  ctx.http.route('POST', '/api/sessions/:id/cancel', (route) => {
    ctx.agents.get(route.params.id)?.cancel()
    route.send(200, { ok: true })
  })
  ctx.http.route('POST', '/api/chat', async (route) => {
    const payload = (await route.json()) as { messages?: ChatMessage[]; sessionId?: string; text?: string }
    const messages = Array.isArray(payload?.messages)
      ? payload.messages
      : [{ role: 'user' as const, content: payload.text ?? '' }]
    try {
      route.send(200, await chat.complete(messages, payload.sessionId))
    } catch (error) {
      route.send(500, { error: String(error) })
    }
  })
}
