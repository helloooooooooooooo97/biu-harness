import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Service, type Context } from 'cordis'
import '../../types.ts'
import type { ChatMessage } from './chat-types.ts'
import type { AgentToolMode } from '../registry/tools.ts'
import { DEFAULT_TAIL_TURNS, sliceBeforeTurns, sliceTailTurns } from '../core/session-window.ts'
import {
  DEFAULT_TRAJECTORY_TURNS,
  buildRequestMessages,
  buildTrajectoryBefore,
  buildTrajectoryWindow,
  findEvent,
} from '../core/trajectory-index.ts'
import { readArtifactFile } from '../core/artifacts.ts'
import { collectLiveDispatchedTasks } from '../seams/live-dispatched-usage.ts'
import { normalizeSessionType } from '../core/session-types.ts'

export type { ChatMessage }

export type ChatProvider = 'deepseek' | 'openai'
export type { AgentToolMode }

interface ChatConfig {
  provider: ChatProvider
  apiKey: string
  model: string
  systemPrompt: string
  agentMode: AgentToolMode
  /** 极简模式下常驻额外工具（不含 minimal 底座与 live 调度工具） */
  extraTools: string[]
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
    extraTools: [],
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
        extraTools: config.extraTools,
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
    extraTools: Array.isArray(saved.extraTools)
      ? [...new Set(saved.extraTools.map((name) => String(name).trim()).filter(Boolean))]
      : base.extraTools,
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
      toolCatalog: this.ctx.tools.catalog(),
      extraTools: this.config.extraTools,
    }
  }

  patch(
    next: Partial<{
      provider: ChatProvider
      apiKey: string
      model: string
      systemPrompt: string
      agentMode: AgentToolMode
      extraTools: string[]
    }>,
    opts?: { persist?: boolean },
  ) {
    if (next.provider) this.config.provider = next.provider
    if (typeof next.model === 'string' && next.model.trim()) this.config.model = next.model.trim()
    if (typeof next.systemPrompt === 'string') this.config.systemPrompt = next.systemPrompt
    if (typeof next.apiKey === 'string' && next.apiKey.trim()) this.config.apiKey = next.apiKey.trim()
    if (next.agentMode === 'standard' || next.agentMode === 'minimal') this.config.agentMode = next.agentMode
    if (Array.isArray(next.extraTools)) {
      this.config.extraTools = [...new Set(next.extraTools.map((name) => String(name).trim()).filter(Boolean))]
    }
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
    this.ctx.tools.setPinnedExtras(this.config.extraTools)
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
      extraTools: string[]
    }>
    route.send(200, chat.patch(payload ?? {}))
  })
  ctx.http.route('POST', '/api/sessions', async (route) => {
    const payload = ((await route.json().catch(() => null)) ?? {}) as { type?: string }
    const type = payload?.type === 'live' ? 'live' : 'chat'
    const record = await ctx.sessions.create(undefined, { type })
    route.send(201, {
      id: record.id,
      version: record.version,
      type: record.type ?? type,
      ...(record.mascot ? { mascot: record.mascot } : {}),
    })
  })
  ctx.http.route('GET', '/api/sessions', async (route) => {
    const items = await ctx.sessions.listSummaries()
    route.send(200, {
      sessions: items.map((item) => ({
        id: item.id,
        version: item.version,
        eventCount: item.eventCount,
        title: item.title,
        updatedAt: item.updatedAt,
        type: item.type ?? 'chat',
        busy: ctx.agents.isBusy(item.id),
        ...(item.project ? { project: item.project } : {}),
        ...(item.mascot ? { mascot: item.mascot } : {}),
      })),
    })
  })
  ctx.http.route('GET', '/api/sessions/:id', async (route) => {
    const record = await ctx.sessions.get(route.params.id)
    if (!record) return route.send(404, { error: 'unknown session' })
    const turnsRaw = route.query.get('turns')
    const limitTurns =
      turnsRaw == null || turnsRaw === ''
        ? DEFAULT_TAIL_TURNS
        : turnsRaw === 'all'
          ? 0
          : Math.max(0, Number(turnsRaw) || DEFAULT_TAIL_TURNS)
    const window = sliceTailTurns(record.events, limitTurns)
    const payload: Record<string, unknown> = {
      id: record.id,
      version: record.version,
      type: record.type ?? 'chat',
      events: window.events,
      hasMore: window.hasMore,
      totalTurns: window.totalTurns,
      totalEvents: window.totalEvents,
      oldestSeq: window.oldestSeq,
      newestSeq: window.newestSeq,
      ...(record.project ? { project: record.project } : {}),
      ...(record.mascot ? { mascot: record.mascot } : {}),
    }
    if ((record.type ?? 'chat') === 'live') {
      const summaries = await ctx.sessions.listSummaries()
      const workers = []
      const titles = new Map<string, string>()
      const mascots = new Map<string, NonNullable<(typeof summaries)[number]['mascot']>>()
      const projects = new Map<string, { name: string; path?: string }>()
      for (const item of summaries) {
        titles.set(item.id, item.title)
        if (item.mascot) mascots.set(item.id, item.mascot)
        if (item.project?.name) {
          projects.set(item.id, {
            name: item.project.name,
            ...(item.project.path ? { path: item.project.path } : {}),
          })
        }
        if (item.id === record.id) continue
        if (normalizeSessionType(item.type) === 'live') continue
        const worker = await ctx.sessions.require(item.id)
        workers.push({ id: item.id, events: worker.events })
      }
      const dispatched = collectLiveDispatchedTasks(record.id, record.events, workers)
      payload.dispatchedUsage = dispatched.total
      payload.dispatchedUsageByTurn = Object.fromEntries(
        Object.entries(dispatched.byLiveTurn).map(([key, value]) => [key, value.usage]),
      )
      payload.dispatchedTasksByTurn = Object.fromEntries(
        Object.entries(dispatched.byLiveTurn).map(([key, value]) => [
          key,
          value.tasks.map((task) => ({
            ...task,
            title: titles.get(task.sessionId) ?? task.sessionId.slice(0, 8),
            ...(mascots.get(task.sessionId) ? { mascot: mascots.get(task.sessionId) } : {}),
            ...(projects.get(task.sessionId) ? { project: projects.get(task.sessionId) } : {}),
          })),
        ]),
      )
    }
    route.send(200, payload)
  })
  ctx.http.route('GET', '/api/sessions/:id/events', async (route) => {
    const record = await ctx.sessions.get(route.params.id)
    if (!record) return route.send(404, { error: 'unknown session' })
    const beforeSeq = Number(route.query.get('beforeSeq'))
    if (!Number.isFinite(beforeSeq)) return route.send(400, { error: 'beforeSeq required' })
    const turnsRaw = route.query.get('turns')
    const limitTurns =
      turnsRaw == null || turnsRaw === ''
        ? DEFAULT_TAIL_TURNS
        : Math.max(1, Number(turnsRaw) || DEFAULT_TAIL_TURNS)
    const window = sliceBeforeTurns(record.events, beforeSeq, limitTurns)
    route.send(200, {
      id: record.id,
      events: window.events,
      hasMore: window.hasMore,
      totalTurns: window.totalTurns,
      totalEvents: window.totalEvents,
      oldestSeq: window.oldestSeq,
      newestSeq: window.newestSeq,
    })
  })
  ctx.http.route('GET', '/api/sessions/:id/trajectory', async (route) => {
    const record = await ctx.sessions.get(route.params.id)
    if (!record) return route.send(404, { error: 'unknown session' })
    const beforeSeqRaw = route.query.get('beforeSeq')
    const turnsRaw = route.query.get('turns')
    const limitTurns =
      turnsRaw == null || turnsRaw === ''
        ? DEFAULT_TRAJECTORY_TURNS
        : turnsRaw === 'all'
          ? 0
          : Math.max(0, Number(turnsRaw) || DEFAULT_TRAJECTORY_TURNS)
    const window =
      beforeSeqRaw != null && beforeSeqRaw !== ''
        ? buildTrajectoryBefore(record.events, Number(beforeSeqRaw), limitTurns || DEFAULT_TRAJECTORY_TURNS)
        : buildTrajectoryWindow(record.events, limitTurns)
    route.send(200, {
      id: record.id,
      rows: window.rows,
      hasMore: window.hasMore,
      totalTurns: window.totalTurns,
      totalEvents: window.totalEvents,
      oldestSeq: window.oldestSeq,
      newestSeq: window.newestSeq,
    })
  })
  ctx.http.route('GET', '/api/sessions/:id/artifacts/:name', async (route) => {
    const record = await ctx.sessions.get(route.params.id)
    if (!record) return route.send(404, { error: 'unknown session' })
    const file = await readArtifactFile(route.params.id, route.params.name)
    if (!file) return route.send(404, { error: 'unknown artifact' })
    if (route.res.headersSent) return
    route.res.writeHead(200, {
      'content-type': file.mime,
      'cache-control': 'private, max-age=3600',
      'content-length': file.data.byteLength,
    })
    route.res.end(file.data)
  })
  ctx.http.route('GET', '/api/sessions/:id/events/:seq', async (route) => {
    const record = await ctx.sessions.get(route.params.id)
    if (!record) return route.send(404, { error: 'unknown session' })
    const seq = Number(route.params.seq)
    if (!Number.isFinite(seq)) return route.send(400, { error: 'invalid seq' })
    const event = findEvent(record.events, seq)
    if (!event) return route.send(404, { error: 'unknown event' })
    route.send(200, { id: record.id, event })
  })
  ctx.http.route('GET', '/api/sessions/:id/events/:seq/request', async (route) => {
    const record = await ctx.sessions.get(route.params.id)
    if (!record) return route.send(404, { error: 'unknown session' })
    const seq = Number(route.params.seq)
    if (!Number.isFinite(seq)) return route.send(400, { error: 'invalid seq' })
    const event = findEvent(record.events, seq)
    if (!event) return route.send(404, { error: 'unknown event' })
    if (event.type !== 'assistant/message') {
      return route.send(400, { error: 'request derivation only for assistant/message' })
    }
    route.send(200, {
      id: record.id,
      seq,
      messages: buildRequestMessages(record.events, seq),
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
  ctx.http.route('POST', '/api/sessions/:id/project/pick', async (route) => {
    try {
      await ctx.sessions.require(route.params.id)
      const { pickHostDirectory } = await import('../seams/workspace-pick.ts')
      const current = (await ctx.sessions.get(route.params.id))?.project?.path
      const path = await pickHostDirectory(current)
      const project = await ctx.sessions.setProject(route.params.id, { path })
      route.send(200, { ok: true, project })
    } catch (error) {
      const name = error instanceof Error ? error.name : ''
      if (name === 'DirectoryPickCancelled') return route.send(200, { ok: false, cancelled: true })
      if (name === 'DirectoryPickUnavailable') return route.send(501, { error: String(error) })
      route.send(400, { error: String(error) })
    }
  })
  ctx.http.route('POST', '/api/sessions/:id/fork', async (route) => {
    try {
      const child = await ctx.sessions.fork(route.params.id)
      route.send(201, {
        id: child.id,
        version: child.version,
        parentId: route.params.id,
        type: child.type ?? 'chat',
        ...(child.mascot ? { mascot: child.mascot } : {}),
      })
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
    const payload = (await route.json()) as {
      text?: string
      kind?: 'wake' | 'inject'
      extraTools?: string[]
    }
    const agent = await ctx.agents.create(route.params.id)
    // re-sync in-memory LLM without rewriting disk
    chat.patch({}, { persist: false })
    const extraTools = Array.isArray(payload.extraTools)
      ? [...new Set(payload.extraTools.map((name) => String(name).trim()).filter(Boolean))]
      : []
    const sendOpts = extraTools.length ? { extraTools } : undefined
    if (payload.kind === 'inject') {
      agent.inject(payload.text ?? '', sendOpts)
      return route.send(200, { sessionId: agent.sessionId, queued: true })
    }
    try {
      const turn = await agent.send(payload.text ?? '', sendOpts)
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
