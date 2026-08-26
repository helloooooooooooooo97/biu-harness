import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Service, type Context } from 'cordis'
import type { ChatMessage } from './chat-types.ts'
import type { AgentToolMode } from '@biu/host-tools'
import type { LlmConfig } from '@biu/host-llm'
import { LLM_MODEL_CATALOG, describeProvider, defaultModelFor, CHAT_PROVIDERS } from './model-catalog.ts'
import type { ChatProvider, LlmModelDef } from './model-catalog.ts'
export type { ChatProvider, LlmModelDef } from './model-catalog.ts'
import { currentSessionId } from '@biu/host-sessions/scope'
import type { SessionConfig, SessionEvent } from '@biu/type-session'
import { DEFAULT_TAIL_TURNS, sliceBeforeTurns, sliceTailTurns } from '@biu/host-sessions/window'
import {
  DEFAULT_TRAJECTORY_TURNS,
  buildRequestMessages,
  buildTrajectoryBefore,
  buildTrajectoryWindow,
  findEvent,
} from '@biu/host-sessions/trajectory'
import { estimateTokens } from '@biu/host-sessions'
import { readArtifactFile } from '@biu/host-sessions/artifacts'
import { collectLiveDispatchedTasks } from '@biu/host-live-sessions/usage'
import { normalizeSessionType } from '@biu/type-session'
import { loadLiveDispatchTasks, registerChatInspectorRoutes } from './inspector.ts'

export type { ChatMessage }

export type { AgentToolMode }

const DEFAULT_PROVIDER: ChatProvider = 'deepseek'

interface ChatConfig {
  provider: ChatProvider
  /** 每个 provider 独立存一份 apiKey；未配置的为空串。 */
  apiKeys: Record<ChatProvider, string>
  model: string
  systemPrompt: string
  agentMode: AgentToolMode
  /** 极简模式下常驻额外工具（不含 minimal 底座与 live 调度工具） */
  extraTools: string[]
}

function configPath() {
  return join(process.cwd(), '.cordis', 'chat-config.json')
}

function emptyKeys(): Record<ChatProvider, string> {
  return { deepseek: '', openai: '', anthropic: '' }
}

function defaults(): ChatConfig {
  const envKeys = emptyKeys()
  if (process.env.DEEPSEEK_API_KEY) envKeys.deepseek = process.env.DEEPSEEK_API_KEY
  if (process.env.OPENAI_API_KEY) envKeys.openai = process.env.OPENAI_API_KEY
  if (process.env.ANTHROPIC_API_KEY) envKeys.anthropic = process.env.ANTHROPIC_API_KEY
  const deepseek = Boolean(envKeys.deepseek)
  const openai = Boolean(envKeys.openai)
  const anthropic = Boolean(envKeys.anthropic)
  const provider: ChatProvider = deepseek ? 'deepseek' : openai ? 'openai' : anthropic ? 'anthropic' : 'deepseek'
  return {
    provider,
    apiKeys: envKeys,
    model:
      process.env.CHAT_MODEL ||
      (provider === 'openai' ? 'gpt-4o-mini' : provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'deepseek-chat'),
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
        apiKeys: config.apiKeys,
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

function parseProvider(value: unknown): ChatProvider | null {
  return CHAT_PROVIDERS.includes(value as ChatProvider) ? (value as ChatProvider) : null
}

/** 取某个 provider 的持久化 key；环境变量始终优先（不会被磁盘文件覆盖 UI 清空）。 */
function keyFor(provider: ChatProvider, saved: Partial<ChatConfig> | null): string {
  const envMap: Record<ChatProvider, string | undefined> = {
    deepseek: process.env.DEEPSEEK_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  }
  if (envMap[provider]) return envMap[provider]
  const savedKeys = saved?.apiKeys
  if (savedKeys && typeof savedKeys === 'object' && typeof (savedKeys as Record<string, unknown>)[provider] === 'string') {
    const key = (savedKeys as Record<string, string>)[provider] || ''
    if (key.trim()) return key.trim()
  }
  // 老格式：单一 apiKey 迁移到 deepseek（或默认 provider 所在）
  const legacy = saved as unknown as { apiKey?: unknown; provider?: unknown } | null
  if (legacy && typeof legacy.apiKey === 'string' && legacy.apiKey.trim()) {
    const owner =
      legacy.provider && CHAT_PROVIDERS.includes(legacy.provider as ChatProvider)
        ? (legacy.provider as ChatProvider)
        : DEFAULT_PROVIDER
    if (provider === owner) return legacy.apiKey.trim()
  }
  return ''
}

function mergePersisted(base: ChatConfig, saved: Partial<ChatConfig> | null): ChatConfig {
  if (!saved) return base
  const apiKeys = emptyKeys()
  for (const provider of CHAT_PROVIDERS) apiKeys[provider] = keyFor(provider, saved)
  return {
    provider: parseProvider(saved.provider) ?? (base.provider in apiKeys && apiKeys[base.provider] ? base.provider : DEFAULT_PROVIDER),
    apiKeys,
    model: !process.env.CHAT_MODEL && typeof saved.model === 'string' && saved.model.trim() ? saved.model.trim() : base.model,
    systemPrompt: typeof saved.systemPrompt === 'string' ? saved.systemPrompt : base.systemPrompt,
    agentMode: parseAgentMode(saved.agentMode, base.agentMode),
    extraTools: Array.isArray(saved.extraTools)
      ? [...new Set(saved.extraTools.map((name) => String(name).trim()).filter(Boolean))]
      : base.extraTools,
  }
}

/** 返回某 provider 是否已配置 key（用于前端「只有配了 token 的模型可选」）。 */
function providerConfigured(keys: Record<ChatProvider, string>): Record<ChatProvider, boolean> {
  return {
    deepseek: Boolean(keys.deepseek.trim()),
    openai: Boolean(keys.openai.trim()),
    anthropic: Boolean(keys.anthropic.trim()),
  }
}

export class ChatService extends Service {
  private config = mergePersisted(defaults(), readPersisted())

  constructor(ctx: Context) {
    super(ctx, 'chat')
    ctx.systemPrompt.register('chat.persona', () => {
      const sessionId = currentSessionId()
      if (sessionId) {
        const override = this.ctx.sessions.peek(sessionId)?.config?.systemPrompt
        if (typeof override === 'string' && override.trim()) return override
      }
      return this.config.systemPrompt
    })
    this.syncLlm()
    this.syncToolsMode()
  }

  publicView() {
    const configured = providerConfigured(this.config.apiKeys)
    return {
      provider: this.config.provider,
      model: this.config.model,
      systemPrompt: this.config.systemPrompt,
      agentMode: this.config.agentMode,
      /** 当前默认 provider 是否已配置（兼容旧语义，供 banner 等使用）。 */
      configured: configured[this.config.provider],
      hint: hint(this.config.apiKeys[this.config.provider]),
      /** 各 provider 是否已配置 key。 */
      providers: {
        deepseek: { label: describeProvider('deepseek'), configured: configured.deepseek, hint: hint(this.config.apiKeys.deepseek) },
        openai: { label: describeProvider('openai'), configured: configured.openai, hint: hint(this.config.apiKeys.openai) },
        anthropic: { label: describeProvider('anthropic'), configured: configured.anthropic, hint: hint(this.config.apiKeys.anthropic) },
      },
      modelCatalog: LLM_MODEL_CATALOG,
      tools: this.ctx.tools.names(),
      toolCatalog: this.ctx.tools.catalog(),
      extraTools: this.config.extraTools,
    }
  }

  /** 全局默认 + 会话覆盖（不含 apiKey）。 */
  resolveEffective(sessionId?: string | null) {
    const defaultsView = {
      provider: this.config.provider,
      model: this.config.model,
      systemPrompt: this.config.systemPrompt,
      agentMode: this.config.agentMode,
      extraTools: [...this.config.extraTools],
    }
    if (!sessionId) return { defaults: defaultsView, config: undefined as SessionConfig | undefined, effective: defaultsView }
    const config = this.ctx.sessions.peek(sessionId)?.config
    const effective = {
      provider: config?.provider ?? defaultsView.provider,
      model: config?.model ?? defaultsView.model,
      systemPrompt:
        typeof config?.systemPrompt === 'string' ? config.systemPrompt : defaultsView.systemPrompt,
      agentMode: config?.agentMode ?? defaultsView.agentMode,
      extraTools: config?.extraTools ? [...config.extraTools] : [...defaultsView.extraTools],
      ...(config?.title ? { title: config.title } : {}),
    }
    return { defaults: defaultsView, config, effective }
  }

  resolverKey(provider: ChatProvider): string {
    return this.config.apiKeys[provider]
  }

  /** 根据有效 provider 取对应 apiKey；未配置则返回空（LLM 层会因鉴权失败抛错，友好提示）。 */
  resolveLlm(sessionId?: string | null): LlmConfig {
    const { effective } = this.resolveEffective(sessionId)
    return {
      provider: effective.provider,
      apiKey: this.config.apiKeys[effective.provider] ?? '',
      model: effective.model,
    }
  }

  /**
   * 更新配置。provider/model/systemPrompt/agentMode/extraTools 直接覆盖；
   * setApiKey(provider, key) 按 provider 独立写入 key；空串表示保留原值，仅非空时更新。
   */
  patch(
    next: Partial<{
      provider: ChatProvider
      apiKey: string
      model: string
      systemPrompt: string
      agentMode: AgentToolMode
      extraTools: string[]
      /** 按 provider 更新 key：{ deepseek?: '…', openai?: '…', anthropic?: '…' } */
      setApiKey: Partial<Record<ChatProvider, string>>
    }>,
    opts?: { persist?: boolean },
  ) {
    if (next.provider) {
      this.config.provider = next.provider
      // 未指定 model 时，默认模型跟随 provider 的默认模型
      if (typeof next.model !== 'string' || !next.model.trim()) {
        this.config.model = defaultModelFor(next.provider)
      }
    }
    if (typeof next.model === 'string' && next.model.trim()) this.config.model = next.model.trim()
    if (typeof next.systemPrompt === 'string') this.config.systemPrompt = next.systemPrompt
    if (next.setApiKey && typeof next.setApiKey === 'object') {
      for (const provider of CHAT_PROVIDERS) {
        const key = next.setApiKey[provider]
        if (typeof key === 'string' && key.trim()) this.config.apiKeys[provider] = key.trim()
      }
    }
    // 兼容旧调用：单一 apiKey 写入当前 provider
    if (typeof next.apiKey === 'string' && next.apiKey.trim()) {
      this.config.apiKeys[this.config.provider] = next.apiKey.trim()
    }
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
    const llm = this.resolveLlm()
    this.ctx.agents.configure(llm)
  }

  private syncToolsMode() {
    this.ctx.tools.setMode(this.config.agentMode)
    this.ctx.tools.setPinnedExtras(this.config.extraTools)
  }
}

export interface TurnStat {
  turn: number
  stepCount: number
  startTs?: number
  endTs?: number
  durationMs?: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  totalTokens: number
}

/**
 * 按 turn 计算会话运行统计（纯函数）：
 * - stepCount：该 turn 内 step/start 数
 * - startTs/endTs/durationMs：turn/start → turn/end 的起止与耗时
 * - 额度消耗：该 turn 内所有 assistant/message 事件 usage 的 input/output/cacheRead 汇总
 * targetTurn 传入时只计算/返回该 turn 的单条统计；否则返回 { turn → stat } 映射。
 */
export function computeTurnStats(events: SessionEvent[], targetTurn?: number): Record<string, TurnStat> | TurnStat {
  const stats: Record<string, TurnStat> = {}
  let turn: number | null = null
  let stepCount = 0
  let startTs: number | null = null
  let endTs: number | null = null
  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0
  let totalTokens = 0
  const flush = (t: number) => {
    if (!turn || turn !== t) return
    if (targetTurn != null && turn !== targetTurn) return
    stats[String(turn)] = {
      turn,
      stepCount,
      ...(startTs != null ? { startTs } : {}),
      ...(endTs != null ? { endTs } : {}),
      ...(startTs != null && endTs != null ? { durationMs: endTs - startTs } : {}),
      inputTokens,
      outputTokens,
      cacheReadTokens,
      totalTokens,
    }
  }
  for (const event of events) {
    if (event.type === 'turn/start') {
      if (turn != null) flush(turn)
      turn = event.turn
      stepCount = 0
      startTs = event.ts
      endTs = null
      inputTokens = 0
      outputTokens = 0
      cacheReadTokens = 0
      totalTokens = 0
    } else if (event.type === 'turn/end' && turn === event.turn) {
      endTs = event.ts
    } else if (event.type === 'step/start' && turn === event.turn) {
      stepCount += 1
    } else if (event.type === 'assistant/message' && event.usage && turn != null) {
      inputTokens += event.usage.inputTokens || 0
      outputTokens += event.usage.outputTokens || 0
      cacheReadTokens += event.usage.cacheReadTokens || 0
      totalTokens += event.usage.totalTokens || (event.usage.inputTokens || 0) + (event.usage.outputTokens || 0)
    }
  }
  if (turn != null) flush(turn)
  if (targetTurn != null) return stats[String(targetTurn)]
  return stats
}

export const name = 'chat'
export const inject = ['http', 'hub', 'agents', 'sessions', 'systemPrompt', 'tools', 'tasks']

declare module 'cordis' {
  interface Context {
    chat: ChatService
  }
}

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
      setApiKey: Partial<Record<ChatProvider, string>>
    }>
    route.send(200, chat.patch(payload ?? {}))
  })
  ctx.http.route('POST', '/api/sessions', async (route) => {
    const payload = ((await route.json().catch(() => null)) ?? {}) as {
      type?: string
      title?: string
    }
    const type = payload?.type === 'live' ? 'live' : 'chat'
    const record = await ctx.sessions.create(undefined, {
      type,
      ...(typeof payload.title === 'string' ? { title: payload.title } : {}),
    })
    route.send(201, {
      id: record.id,
      version: record.version,
      type: record.type ?? type,
      title: record.config?.title,
      ...(record.mascot ? { mascot: record.mascot } : {}),
      ...(record.config ? { config: record.config } : {}),
    })
  })
  ctx.http.route('PATCH', '/api/sessions/:id/config', async (route) => {
    try {
      const payload = ((await route.json().catch(() => null)) ?? {}) as Record<string, unknown>
      const patch: {
        title?: string | null
        model?: string
        provider?: SessionConfig['provider']
        systemPrompt?: string | null
        agentMode?: 'standard' | 'minimal'
        extraTools?: string[]
        tags?: string[]
        pinned?: boolean
      } = {}
      if (typeof payload.title === 'string' || payload.title === null) patch.title = payload.title as string | null
      if (typeof payload.model === 'string') patch.model = payload.model
      if (payload.provider === 'deepseek' || payload.provider === 'openai' || payload.provider === 'anthropic') {
        patch.provider = payload.provider
      }
      if (typeof payload.systemPrompt === 'string' || payload.systemPrompt === null) {
        patch.systemPrompt = payload.systemPrompt as string | null
      }
      if (payload.agentMode === 'standard' || payload.agentMode === 'minimal') patch.agentMode = payload.agentMode
      if (Array.isArray(payload.extraTools)) patch.extraTools = payload.extraTools.map((name) => String(name))
      if (Array.isArray(payload.tags)) patch.tags = payload.tags.map((name) => String(name))
      if (typeof payload.pinned === 'boolean') patch.pinned = payload.pinned
      const record = await ctx.sessions.patchConfig(
        route.params.id,
        patch as SessionConfig & { title?: string | null; systemPrompt?: string | null },
      )
      const resolved = chat.resolveEffective(record.id)
      route.send(200, {
        id: record.id,
        config: record.config ?? null,
        defaults: resolved.defaults,
        effective: resolved.effective,
      })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
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
        tags: item.config?.tags ?? [],
        pinned: Boolean(item.config?.pinned),
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
      const liveTasks = await loadLiveDispatchTasks(ctx, record.id)
      const dispatched = collectLiveDispatchedTasks(record.id, record.events, workers, liveTasks)
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
  // 全量 usage 趋势：提取本会话所有 step（assistant/message 带 usage）的 input/output/cacheRead，供前端折线图。
  ctx.http.route('GET', '/api/sessions/:id/usage-trend', async (route) => {
    const record = await ctx.sessions.get(route.params.id)
    if (!record) return route.send(404, { error: 'unknown session' })
    const points: Array<{ seq: number; turn: number; input: number; output: number; cache: number }> = []
    const compactions: number[] = []
    let turn = 0
    for (const event of record.events) {
      if (event.type === 'step/start') turn = event.turn
      if (
        event.type === 'tool/call' &&
        (event.name === 'context_compact_submit' || event.name === 'context_clear')
      ) {
        // 压缩点：仅「真正提交上下文压缩」的 context_compact_submit / context_clear 调用；
        // session_compact（旧压缩）与其它的 status/brief 查询类不算压缩点。
        compactions.push(event.seq)
        continue
      }
      if (event.type !== 'assistant/message' || !event.usage) continue
      points.push({
        seq: event.seq,
        turn,
        input: event.usage.inputTokens || 0,
        output: event.usage.outputTokens || 0,
        cache: event.usage.cacheReadTokens || 0,
      })
    }
    route.send(200, { points, compactions })
  })
  // 按 turn 取跨 session 统计：给定某 turn，返回 step 数 / 起止 / 耗时 / token 与额度消耗。
  // 供任务面板在展示 task_report 回传条时定位到 report.sessionId 所属 session 的该 turn 运行统计。
  ctx.http.route('GET', '/api/sessions/:id/turn-stats', async (route) => {
    const record = await ctx.sessions.get(route.params.id)
    if (!record) return route.send(404, { error: 'unknown session' })
    const turnsRaw = route.query.get('turn')
    const targetTurn =
      turnsRaw != null && turnsRaw !== '' && Number.isFinite(Number(turnsRaw)) ? Number(turnsRaw) : undefined
    const result = computeTurnStats(record.events, targetTurn)
    if (targetTurn != null) {
      if (!result) return route.send(404, { error: 'unknown turn' })
      return route.send(200, result)
    }
    route.send(200, { turns: result as Record<string, TurnStat> })
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
    // 工具定义 token 估算：当前可见工具集合 schema 序列化后的估算值（轨迹回放时各 step 近似恒定）。
    // 与 agent-loop 实际传给 LLM 的 ctx.tools.schemas() 对齐，作为第 4 类「工具定义」占比基线。
    const toolsSchemaTokens = estimateTokens(JSON.stringify(ctx.tools.schemas()))
    route.send(200, {
      id: record.id,
      seq,
      messages: buildRequestMessages(record.events, seq),
      toolsTokens: toolsSchemaTokens,
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
      const { pickHostDirectory } = await import('@biu/host-fs/workspace-pick')
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
      wait?: boolean
      extraTools?: string[]
    }
    const agent = await ctx.agents.create(route.params.id)
    // re-sync in-memory LLM without rewriting disk
    chat.patch({}, { persist: false })
    const extraTools = Array.isArray(payload.extraTools)
      ? [...new Set(payload.extraTools.map((name) => String(name).trim()).filter(Boolean))]
      : []
    const sendOpts = {
      ...(extraTools.length ? { extraTools } : {}),
      ...(payload.wait === false ? { wait: false as const } : {}),
    }
    if (payload.kind === 'inject') {
      agent.inject(payload.text ?? '', sendOpts)
      return route.send(200, {
        sessionId: agent.sessionId,
        queued: true,
        inbox: ctx.agents.listInbox(agent.sessionId),
      })
    }
    try {
      const turn = await agent.send(payload.text ?? '', sendOpts)
      route.send(200, {
        sessionId: agent.sessionId,
        text: turn.text,
        steps: turn.steps,
        queued: Boolean(sendOpts.wait === false || ctx.agents.isBusy(agent.sessionId)),
        inbox: ctx.agents.listInbox(agent.sessionId),
      })
    } catch (error) {
      route.send(500, { error: String(error) })
    }
  })
  ctx.http.route('GET', '/api/sessions/:id/inbox', async (route) => {
    const id = route.params.id
    if (!(await ctx.sessions.get(id))) return route.send(404, { error: 'unknown session' })
    await ctx.agents.create(id)
    route.send(200, { sessionId: id, inbox: ctx.agents.listInbox(id) })
  })
  ctx.http.route('POST', '/api/sessions/:id/cancel', (route) => {
    ctx.agents.get(route.params.id)?.cancel()
    route.send(200, { ok: true })
  })
  // 清空上下文：不经过大模型，仅向会话事件日志插入一条 context_clear tool/call 记录（作为压缩点）。
  ctx.http.route('POST', '/api/sessions/:id/clear-context', async (route) => {
    const id = route.params.id
    if (!(await ctx.sessions.get(id))) return route.send(404, { error: 'unknown session' })
    const event = await ctx.sessions.append(id, {
      type: 'tool/call',
      id: crypto.randomUUID(),
      name: 'context_clear',
      arguments: '{}',
    })
    route.send(200, { ok: true, sessionId: id, seq: event.seq, ts: event.ts })
  })
  ctx.http.route('POST', '/api/sessions/:id/inbox/flush', async (route) => {
    const id = route.params.id
    if (!(await ctx.sessions.get(id))) return route.send(404, { error: 'unknown session' })
    const agent = await ctx.agents.create(id)
    chat.patch({}, { persist: false })
    try {
      const result = await agent.flush({ wait: false })
      route.send(200, {
        sessionId: id,
        flushed: result.flushed,
        inbox: ctx.agents.listInbox(id),
      })
    } catch (error) {
      route.send(500, { error: String(error) })
    }
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
  registerChatInspectorRoutes(ctx)
}
