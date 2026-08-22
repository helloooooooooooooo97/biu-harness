import type { Context } from 'cordis'
import '../../types.ts'
import { MINIMAL_TOOL_NAMES, type AgentToolMode } from '../registry/tools.ts'
import { LIVE_TOOL_NAMES, buildSessionProgress } from './live-sessions.ts'
import { normalizeSessionType, type SessionType } from '../core/session-types.ts'

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
    }
    route.send(200, body)
  })
}
