import type { Context } from 'cordis'
import '../../types.ts'
import { MINIMAL_TOOL_NAMES, type AgentToolMode } from '../registry/tools.ts'
import { LIVE_TOOL_NAMES, buildSessionProgress } from './live-sessions.ts'
import { collectLiveDispatchedTasks } from './live-dispatched-usage.ts'
import { normalizeSessionType, type SessionEvent, type SessionType } from '../core/session-types.ts'

export type ToolSourceId = 'minimal' | 'live' | 'plugin'

export interface InspectorToolRow {
  name: string
  description: string
  source: ToolSourceId
  /** 当前 session 实际可用 */
  active: boolean
  /** 极简模式下可否勾选为常驻额外工具 */
  configurable: boolean
}

export interface InspectorSourceInfo {
  id: ToolSourceId
  label: string
  description: string
}

export interface InspectorWorkerRow {
  id: string
  title: string
  type: SessionType
  status: 'idle' | 'running'
  turn: number | null
  step: number | null
  lastTool: string | null
  assistantText: string
  updatedAt: number
  inboxPending: number
  project?: string
  mascot?: { shape: string; color: string }
}

const SOURCE_INFO: InspectorSourceInfo[] = [
  {
    id: 'minimal',
    label: '极简模式',
    description: 'agentMode=minimal 时的底座工具（bash、str_replace_editor）。',
  },
  {
    id: 'live',
    label: 'Live 调度',
    description: '仅 live session 回合自动解锁的指挥工具。',
  },
  {
    id: 'plugin',
    label: '插件注册',
    description: '各 seams/插件注册的工具；standard 全开，minimal 需勾选常驻或 slash 临时放开。',
  },
]

export function toolSourceOf(name: string): ToolSourceId {
  if ((MINIMAL_TOOL_NAMES as readonly string[]).includes(name)) return 'minimal'
  if ((LIVE_TOOL_NAMES as readonly string[]).includes(name)) return 'live'
  return 'plugin'
}

export function isToolActiveForSession(opts: {
  name: string
  mode: AgentToolMode
  sessionType: SessionType
  pinnedExtras: readonly string[]
}): boolean {
  if (opts.mode === 'standard') return true
  if ((MINIMAL_TOOL_NAMES as readonly string[]).includes(opts.name)) return true
  if (opts.sessionType === 'live' && (LIVE_TOOL_NAMES as readonly string[]).includes(opts.name)) {
    return true
  }
  return opts.pinnedExtras.includes(opts.name)
}

export function buildInspectorTools(
  catalog: Array<{ name: string; description: string }>,
  opts: { mode: AgentToolMode; sessionType: SessionType; pinnedExtras: readonly string[] },
): InspectorToolRow[] {
  return catalog
    .map((item) => {
      const source = toolSourceOf(item.name)
      return {
        name: item.name,
        description: item.description,
        source,
        active: isToolActiveForSession({
          name: item.name,
          mode: opts.mode,
          sessionType: opts.sessionType,
          pinnedExtras: opts.pinnedExtras,
        }),
        configurable: opts.mode === 'minimal' && source === 'plugin',
      }
    })
    .sort((a, b) => {
      const order = { minimal: 0, live: 1, plugin: 2 } as const
      const diff = order[a.source] - order[b.source]
      return diff !== 0 ? diff : a.name.localeCompare(b.name)
    })
}

export async function buildLiveWorkers(ctx: Context, selfId: string): Promise<InspectorWorkerRow[]> {
  const items = await ctx.sessions.listSummaries()
  const workers: InspectorWorkerRow[] = []
  for (const item of items) {
    if (item.id === selfId) continue
    if (normalizeSessionType(item.type) === 'live') continue
    const record = await ctx.sessions.require(item.id)
    const progress = buildSessionProgress(record.events, {
      busy: ctx.agents.isBusy(item.id),
      inboxPending: ctx.agents.inboxPending(item.id),
      textLimit: 180,
    })
    workers.push({
      id: item.id,
      title: item.title,
      type: normalizeSessionType(item.type),
      status: progress.status,
      turn: progress.turn,
      step: progress.step,
      lastTool: progress.lastTool?.name ?? null,
      assistantText: progress.assistantText,
      updatedAt: progress.updatedAt || item.updatedAt,
      inboxPending: progress.inboxPending,
      project: item.project?.name,
      ...(item.mascot ? { mascot: item.mascot } : {}),
    })
  }
  workers.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'running' ? -1 : 1
    return b.updatedAt - a.updatedAt
  })
  return workers
}

export const name = 'session-inspector'
export const inject = ['http', 'sessions', 'agents', 'tools', 'chat']

export function apply(ctx: Context) {
  ctx.http.route('GET', '/api/sessions/:id/inspector', async (route) => {
    const id = route.params.id
    const record = await ctx.sessions.get(id)
    if (!record) return route.send(404, { error: 'unknown session' })
    const sessionType = normalizeSessionType(record.type)
    const view = ctx.chat.publicView() as {
      agentMode?: string
      extraTools?: string[]
    }
    const mode: AgentToolMode = view.agentMode === 'minimal' ? 'minimal' : 'standard'
    const pinnedExtras = Array.isArray(view.extraTools) ? view.extraTools : []
    const tools = buildInspectorTools(ctx.tools.catalog(), { mode, sessionType, pinnedExtras })
    const body: Record<string, unknown> = {
      sessionId: id,
      type: sessionType,
      agentMode: mode,
      extraTools: pinnedExtras,
      sources: SOURCE_INFO,
      tools,
    }
    if (sessionType === 'live') {
      body.workers = await buildLiveWorkers(ctx, id)
      const dispatched = await loadDispatchedUsage(ctx, id, record.events)
      const titles = new Map<string, string>()
      const mascots = new Map<string, { shape: string; color: string; eye?: number }>()
      const projects = new Map<string, { name: string; path?: string }>()
      for (const item of await ctx.sessions.listSummaries()) {
        titles.set(item.id, item.title)
        if (item.mascot) mascots.set(item.id, item.mascot)
        if (item.project?.name) {
          projects.set(item.id, {
            name: item.project.name,
            ...(item.project.path ? { path: item.project.path } : {}),
          })
        }
      }
      body.dispatchedUsage = dispatched.total
      body.dispatchedUsageByTurn = Object.fromEntries(
        Object.entries(dispatched.byLiveTurn).map(([key, value]) => [key, value.usage]),
      )
      body.dispatchedTasksByTurn = Object.fromEntries(
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
    route.send(200, body)
  })

  ctx.http.route('GET', '/api/sessions/:id/dispatched-usage', async (route) => {
    const id = route.params.id
    const record = await ctx.sessions.get(id)
    if (!record) return route.send(404, { error: 'unknown session' })
    if (normalizeSessionType(record.type) !== 'live') {
      return route.send(200, {
        sessionId: id,
        dispatchedUsage: null,
        dispatchedUsageByTurn: {},
        dispatchedTasksByTurn: {},
      })
    }
    const dispatched = await loadDispatchedUsage(ctx, id, record.events)
    const titles = new Map<string, string>()
    const mascots = new Map<string, { shape: string; color: string; eye?: number }>()
    const projects = new Map<string, { name: string; path?: string }>()
    for (const item of await ctx.sessions.listSummaries()) {
      titles.set(item.id, item.title)
      if (item.mascot) mascots.set(item.id, item.mascot)
      if (item.project?.name) {
        projects.set(item.id, {
          name: item.project.name,
          ...(item.project.path ? { path: item.project.path } : {}),
        })
      }
    }
    const tasksByTurn: Record<string, Array<Record<string, unknown>>> = {}
    const usageByTurn: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(dispatched.byLiveTurn)) {
      usageByTurn[key] = value.usage
      tasksByTurn[key] = value.tasks.map((task) => ({
        ...task,
        title: titles.get(task.sessionId) ?? task.sessionId.slice(0, 8),
        ...(mascots.get(task.sessionId) ? { mascot: mascots.get(task.sessionId) } : {}),
        ...(projects.get(task.sessionId) ? { project: projects.get(task.sessionId) } : {}),
      }))
    }
    route.send(200, {
      sessionId: id,
      dispatchedUsage: dispatched.total,
      dispatchedUsageByTurn: usageByTurn,
      dispatchedTasksByTurn: tasksByTurn,
    })
  })
}

async function loadDispatchedUsage(ctx: Context, liveId: string, liveEvents: SessionEvent[]) {
  const summaries = await ctx.sessions.listSummaries()
  const workers: Array<{ id: string; events: SessionEvent[] }> = []
  for (const item of summaries) {
    if (item.id === liveId) continue
    if (normalizeSessionType(item.type) === 'live') continue
    const worker = await ctx.sessions.require(item.id)
    workers.push({ id: item.id, events: worker.events })
  }
  return collectLiveDispatchedTasks(liveId, liveEvents, workers)
}
