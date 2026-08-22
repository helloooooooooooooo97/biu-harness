import { useSyncExternalStore } from 'react'
import { Service, type Context } from 'cordis'
import {
  compactSessionEvents,
  mergeDispatchedUsageIntoNodes,
  projectNodes,
  type ChatNode,
  type DerivedMessage,
  type SessionEvent,
  type TrajectoryRow,
  type TrajectoryUsage,
} from './session-project.ts'
import type { AppRoute } from './session-route.ts'
import { markSidebarMascotFresh } from './session-mascot-fresh.ts'

export interface ApprovalItem {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface SessionListItem {
  id: string
  title: string
  eventCount: number
  updatedAt: number
  type?: 'chat' | 'live'
  /** host 列表快照：该 session 的 agent 是否在跑 */
  busy?: boolean
  project?: { name: string; path?: string; boundAt: number }
  mascot?: { shape: string; color: string; eye?: number }
}

export type ConversationView = 'chat' | 'debug'
export type ApprovalMode = 'auto' | 'hold'

/** Live 派工子任务（衍生查询，不入 session 日志） */
export type DispatchedTaskRow = {
  sessionId: string
  title?: string
  project?: { name: string; path?: string }
  mascot?: { shape: string; color: string; eye?: number }
  tool: 'session_wake' | 'session_inject'
  liveTurn?: number
  wakeTs?: number
  status: 'pending' | 'running' | 'complete' | 'ended'
  reason?: string
  workerTurn?: number
  usage?: TrajectoryUsage
  preview?: string
}

/** 当前 session agent inbox 中尚未 claim 的排队消息 */
export type InboxQueueItem = {
  id: string
  kind: 'wake' | 'inject'
  text: string
}

/** 与 host DEFAULT_TAIL_TURNS 对齐；仅 loadOlder 分页仍用窗口拉取 */
export const SESSION_TAIL_TURNS = 24
export const TRAJECTORY_TAIL_TURNS = 48
/** 打开会话一次拉全量：上滑不再等网络；列表行常驻 DOM（content-visibility 跳过屏外绘制） */
export const SESSION_LOAD_TURNS = 'all' as const

export interface SessionViewState {
  sessionId: string | null
  events: SessionEvent[]
  nodes: ChatNode[]
  trajectory: TrajectoryRow[]
  sessions: SessionListItem[]
  view: ConversationView
  focusCallId?: string
  agentStatus: 'idle' | 'running'
  agentStep?: number
  pending: boolean
  /** 忙碌时已入队、尚未开始的 wake/inject */
  inbox: InboxQueueItem[]
  /** 任意 session 的 busy（含 Live 派工的 worker）；侧栏 mascot 用 */
  busySessions: Record<string, true>
  approvalMode: ApprovalMode
  approvals: ApprovalItem[]
  project?: { name: string; path?: string; boundAt: number }
  /** Chat 是否还有更早 turn */
  hasMoreOlder: boolean
  loadingOlder: boolean
  /** Trajectory 索引是否还有更早 turn */
  trajectoryHasMore: boolean
  trajectoryLoading: boolean
  totalTurns: number
  /** Live：其它 session 被本席 wake 的 turn usage（按 Live turn 号） */
  dispatchedUsageByTurn: Record<string, TrajectoryUsage>
  /** Live：派工子任务（按 Live turn 号，衍生查询） */
  dispatchedTasksByTurn: Record<string, DispatchedTaskRow[]>
  /** Live：派工 turn usage 合计 */
  dispatchedUsage?: TrajectoryUsage
  /** 切会话且无缓存：保留上一段画面直到新数据到齐，避免先闪 EmptyHero */
  switchingSession: boolean
  error?: string
}

const empty: SessionViewState = {
  sessionId: null,
  events: [],
  nodes: [],
  trajectory: [],
  sessions: [],
  view: 'chat',
  agentStatus: 'idle',
  pending: false,
  inbox: [],
  busySessions: {},
  approvalMode: 'auto',
  approvals: [],
  hasMoreOlder: false,
  loadingOlder: false,
  trajectoryHasMore: false,
  trajectoryLoading: false,
  totalTurns: 0,
  dispatchedUsageByTurn: {},
  dispatchedTasksByTurn: {},
  switchingSession: false,
}

type SessionPayload = {
  id: string
  events: SessionEvent[]
  type?: 'chat' | 'live'
  hasMore?: boolean
  totalTurns?: number
  totalEvents?: number
  project?: { name: string; path?: string; boundAt: number }
  dispatchedUsage?: TrajectoryUsage
  dispatchedUsageByTurn?: Record<string, TrajectoryUsage>
  dispatchedTasksByTurn?: Record<string, DispatchedTaskRow[]>
}

type TrajectoryPayload = {
  id: string
  rows?: TrajectoryRow[]
  hasMore?: boolean
  totalTurns?: number
}

type SessionCacheEntry = {
  events: SessionEvent[]
  nodes: ChatNode[]
  project?: { name: string; path?: string; boundAt: number }
  hasMoreOlder: boolean
  totalTurns: number
  dispatchedUsageByTurn: Record<string, TrajectoryUsage>
  dispatchedTasksByTurn: Record<string, DispatchedTaskRow[]>
  dispatchedUsage?: TrajectoryUsage
}

const SESSION_CACHE_MAX = 16

function sessionsEqual(a: SessionListItem[], b: SessionListItem[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!
    const right = b[i]!
    if (
      left.id !== right.id ||
      left.title !== right.title ||
      left.eventCount !== right.eventCount ||
      left.updatedAt !== right.updatedAt ||
      left.project?.path !== right.project?.path ||
      left.project?.name !== right.project?.name ||
      left.mascot?.shape !== right.mascot?.shape ||
      left.mascot?.color !== right.mascot?.color ||
      left.mascot?.eye !== right.mascot?.eye ||
      Boolean(left.busy) !== Boolean(right.busy) ||
      (left.type ?? 'chat') !== (right.type ?? 'chat')
    ) {
      return false
    }
  }
  return true
}

export class SessionViewService extends Service {
  private value: SessionViewState = empty
  private listeners = new Set<() => void>()
  /** 切会话瞬时缓存：避免每次都等网络才卸掉旧 Chat DOM */
  private cache = new Map<string, SessionCacheEntry>()
  private cacheOrder: string[] = []
  private loadGen = 0
  private dispatchedPoll: ReturnType<typeof setInterval> | null = null

  constructor(ctx: Context) {
    super(ctx, 'sessionView')
    void this.refreshSessions()
    void this.refreshApprovals()
    this.ctx.on('dispose', () => this.stopDispatchedPoll())
  }

  private buildNodes(events: SessionEvent[], byTurn = this.value.dispatchedUsageByTurn) {
    return mergeDispatchedUsageIntoNodes(projectNodes(events), byTurn)
  }

  private stopDispatchedPoll() {
    if (this.dispatchedPoll) {
      clearInterval(this.dispatchedPoll)
      this.dispatchedPoll = null
    }
  }

  private syncDispatchedPoll() {
    this.stopDispatchedPoll()
    const id = this.value.sessionId
    if (!id) return
    const type = this.value.sessions.find((item) => item.id === id)?.type ?? 'chat'
    if (type !== 'live') return
    this.dispatchedPoll = setInterval(() => {
      void this.refreshDispatchedUsage()
    }, 2000)
  }

  async refreshDispatchedUsage() {
    const sessionId = this.value.sessionId
    if (!sessionId) return
    try {
      const res = await fetch(`/api/sessions/${sessionId}/dispatched-usage`)
      if (!res.ok || this.value.sessionId !== sessionId) return
      const body = (await res.json()) as {
        dispatchedUsage?: TrajectoryUsage | null
        dispatchedUsageByTurn?: Record<string, TrajectoryUsage>
        dispatchedTasksByTurn?: Record<string, DispatchedTaskRow[]>
      }
      const byTurn = body.dispatchedUsageByTurn ?? {}
      const tasksByTurn = body.dispatchedTasksByTurn ?? {}
      const dispatchedUsage = body.dispatchedUsage ?? undefined
      if (
        JSON.stringify(byTurn) === JSON.stringify(this.value.dispatchedUsageByTurn) &&
        JSON.stringify(tasksByTurn) === JSON.stringify(this.value.dispatchedTasksByTurn) &&
        JSON.stringify(dispatchedUsage) === JSON.stringify(this.value.dispatchedUsage)
      ) {
        return
      }
      this.replace({
        dispatchedUsageByTurn: byTurn,
        dispatchedTasksByTurn: tasksByTurn,
        dispatchedUsage,
        nodes: this.buildNodes(this.value.events, byTurn),
      })
      this.stashCurrent()
    } catch {
      /* 静默 */
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  get = () => this.value

  setView(view: ConversationView) {
    this.replace({ view, focusCallId: view === 'chat' ? undefined : this.value.focusCallId })
    if (view === 'debug') void this.ensureTrajectory()
  }

  inspectCall(callId: string) {
    this.replace({ focusCallId: callId })
    void this.ensureTrajectory()
  }

  /** URL → 状态：只由路由层调用，不回写 URL */
  async applyRoute(route: AppRoute) {
    if (route.kind === 'module') {
      return
    }
    if (route.kind === 'home') {
      if (!this.value.sessionId && this.value.view === 'chat') return
      this.stashCurrent()
      this.loadGen += 1
      this.replace({
        sessionId: null,
        events: [],
        nodes: [],
        trajectory: [],
        view: 'chat',
        focusCallId: undefined,
        pending: false,
        agentStatus: 'idle',
        inbox: [],
        project: undefined,
        hasMoreOlder: false,
        loadingOlder: false,
        trajectoryHasMore: false,
        trajectoryLoading: false,
        totalTurns: 0,
        switchingSession: false,
        error: undefined,
      })
      return
    }
    if (this.value.sessionId !== route.sessionId) {
      try {
        await this.load(route.sessionId, { view: route.view })
      } catch (error) {
        this.replace({
          error: String(error),
          sessionId: null,
          events: [],
          nodes: [],
          trajectory: [],
          view: 'chat',
          focusCallId: undefined,
          hasMoreOlder: false,
          loadingOlder: false,
          trajectoryHasMore: false,
          trajectoryLoading: false,
          totalTurns: 0,
          switchingSession: false,
        })
        throw error
      }
    } else if (this.value.view !== route.view) {
      this.replace({
        view: route.view,
        focusCallId: route.view === 'chat' ? undefined : this.value.focusCallId,
      })
    }
    if (route.view === 'debug') await this.ensureTrajectory()
  }

  ingest(sessionId: string, event: SessionEvent) {
    if (this.value.sessionId && this.value.sessionId !== sessionId) {
      void this.refreshSessions()
      return
    }
    // 切会话过渡期仍挂着上一段 nodes，勿把新 session 的流式事件混进去
    if (this.value.switchingSession) {
      void this.refreshSessions()
      return
    }
    if (event.type === 'assistant/chunk') {
      this.ingestChunk(sessionId, event)
      return
    }
    this.flushChunkFrame()
    const events = upsertEvent(this.value.sessionId === sessionId ? this.value.events : [], event)
    this.replace({
      sessionId,
      events,
      nodes: this.buildNodes(events),
      error: undefined,
    })
    this.stashCurrent()
    // Trajectory 索引走独立接口；运行中只做轻量刷新，不塞全文 events
    if (this.value.view === 'debug') void this.refreshTrajectoryIndex()
    void this.refreshSessions()
  }

  private ingestChunk(sessionId: string, event: Extract<SessionEvent, { type: 'assistant/chunk' }>) {
    const events = upsertEvent(this.value.sessionId === sessionId ? this.value.events : [], event)
    const chunk = events.at(-1)
    const nodes =
      chunk?.type === 'assistant/chunk'
        ? patchStreamingNodes(this.value.nodes, chunk)
        : this.buildNodes(events)
    this.value = {
      ...this.value,
      sessionId,
      events,
      nodes,
      error: undefined,
    }
    this.scheduleChunkNotify()
  }

  private chunkRaf: number | null = null

  private scheduleChunkNotify() {
    if (this.chunkRaf != null) return
    const schedule =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number
    this.chunkRaf = schedule(() => {
      this.chunkRaf = null
      for (const fn of this.listeners) fn()
    }) as number
  }

  private flushChunkFrame() {
    if (this.chunkRaf == null) return
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.chunkRaf)
    else clearTimeout(this.chunkRaf)
    this.chunkRaf = null
    for (const fn of this.listeners) fn()
  }

  setAgentStatus(status: 'idle' | 'running', step?: number, sessionId?: string) {
    const id = sessionId ?? this.value.sessionId
    const isOther = Boolean(sessionId && this.value.sessionId && sessionId !== this.value.sessionId)

    if (status === 'running') {
      const alreadyBusy = Boolean(id && this.value.busySessions[id])
      if (isOther) {
        // worker 步进会连发 running：busy 集合没变就别 notify，避免侧栏跟着抖
        if (alreadyBusy || !id) return
        this.replace({ busySessions: { ...this.value.busySessions, [id]: true } })
        return
      }
      const busySessions =
        alreadyBusy || !id
          ? this.value.busySessions
          : { ...this.value.busySessions, [id]: true as const }
      if (
        this.value.agentStatus === 'running' &&
        this.value.pending &&
        this.value.agentStep === step &&
        busySessions === this.value.busySessions
      ) {
        return
      }
      this.replace({
        ...(busySessions === this.value.busySessions ? {} : { busySessions }),
        agentStatus: 'running',
        agentStep: step,
        pending: true,
      })
      return
    }

    // idle
    const nextBusy = { ...this.value.busySessions }
    if (id && nextBusy[id]) delete nextBusy[id]
    const busyChanged = Boolean(id && this.value.busySessions[id])
    if (isOther) {
      if (!busyChanged) return
      this.replace({ busySessions: nextBusy })
      return
    }
    if (
      this.value.agentStatus === 'idle' &&
      !this.value.pending &&
      this.value.agentStep === step &&
      !busyChanged
    ) {
      return
    }
    this.replace({
      ...(busyChanged ? { busySessions: nextBusy } : {}),
      agentStatus: 'idle',
      agentStep: step,
      pending: false,
    })
  }

  /** 切会话时按 busySessions 恢复当前栏 pending/agentStatus */
  private busyFlagsFor(sessionId: string | null | undefined) {
    const running = Boolean(sessionId && this.value.busySessions[sessionId])
    return {
      pending: running,
      agentStatus: (running ? 'running' : 'idle') as 'idle' | 'running',
    }
  }

  private syncBusyFromSessions(sessions: SessionListItem[]) {
    const busySessions = { ...this.value.busySessions }
    let changed = false
    const currentId = this.value.sessionId
    for (const item of sessions) {
      if (item.busy) {
        if (!busySessions[item.id]) {
          busySessions[item.id] = true
          changed = true
        }
      } else if (busySessions[item.id]) {
        // 当前会话正在 pending 时别被列表抖动清掉（send 乐观更新早于 isBusy）
        if (item.id === currentId && this.value.pending) continue
        delete busySessions[item.id]
        changed = true
      }
    }
    return changed ? busySessions : null
  }

  upsertApproval(item: ApprovalItem) {
    const approvals = [...this.value.approvals.filter((row) => row.id !== item.id), item]
    this.replace({ approvals })
  }

  removeApproval(id: string) {
    this.replace({ approvals: this.value.approvals.filter((row) => row.id !== id) })
  }

  async refreshSessions() {
    try {
      const res = await fetch('/api/sessions')
      if (!res.ok) return
      const body = (await res.json()) as { sessions?: SessionListItem[] }
      const next = Array.isArray(body.sessions) ? body.sessions : []
      const busySessions = this.syncBusyFromSessions(next)
      const sessionsChanged = !sessionsEqual(this.value.sessions, next)
      if (!sessionsChanged && !busySessions) return
      const patch: Partial<SessionViewState> = {}
      if (sessionsChanged) patch.sessions = next
      if (busySessions) {
        patch.busySessions = busySessions
        const currentId = this.value.sessionId
        if (currentId) {
          const running = Boolean(busySessions[currentId])
          patch.agentStatus = running ? 'running' : 'idle'
          patch.pending = running
        }
      }
      this.replace(patch)
    } catch {
      /* host 未就绪时忽略 */
    }
  }

  async refreshApprovals() {
    try {
      const res = await fetch('/api/approvals')
      if (!res.ok) return
      const body = (await res.json()) as {
        mode?: ApprovalMode
        pending?: ApprovalItem[]
      }
      const approvalMode = body.mode === 'hold' ? 'hold' : 'auto'
      const approvals = Array.isArray(body.pending) ? body.pending : []
      if (
        this.value.approvalMode === approvalMode &&
        this.value.approvals.length === approvals.length &&
        this.value.approvals.every((item, index) => item.id === approvals[index]?.id)
      ) {
        return
      }
      this.replace({ approvalMode, approvals })
    } catch {
      /* host 未就绪时忽略 */
    }
  }

  async setApprovalMode(mode: ApprovalMode) {
    const res = await fetch('/api/approvals/mode', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
    const body = (await res.json()) as { mode?: ApprovalMode }
    if (!res.ok) throw new Error('failed to set approval mode')
    this.replace({ approvalMode: body.mode === 'hold' ? 'hold' : 'auto' })
  }

  async newSession(opts: { type?: 'chat' | 'live'; projectPath?: string } = {}) {
    const type = opts.type === 'live' ? 'live' : 'chat'
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    const body = (await res.json()) as { id?: string }
    if (!body.id) throw new Error('无法创建 session')
    const projectPath = opts.projectPath?.trim()
    if (projectPath) {
      const bind = await fetch(`/api/sessions/${body.id}/project`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: projectPath }),
      })
      if (!bind.ok) {
        const err = (await bind.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || `绑定项目失败：${bind.status}`)
      }
    }
    markSidebarMascotFresh(body.id)
    await this.load(body.id, { view: 'chat' })
    await this.refreshSessions()
    return body.id
  }

  async ensureSession() {
    if (this.value.sessionId) return this.value.sessionId
    return this.newSession()
  }

  async load(sessionId: string, options: { view?: ConversationView; wait?: boolean } = {}) {
    const view = options.view ?? this.value.view
    const wait = options.wait === true
    const switching = Boolean(this.value.sessionId && this.value.sessionId !== sessionId)
    if (switching) this.stashCurrent()

    const cached = this.cache.get(sessionId)
    const needSwap = this.value.sessionId !== sessionId
    const listedProject = this.value.sessions.find((item) => item.id === sessionId)?.project

    // 路由切换（含空会话 / 冷启动）：立刻换壳，网络只后台校对，绝不 await
    if (!wait) {
      if (cached) {
        this.touchCache(sessionId)
        this.loadGen += 1
        this.applyCached(sessionId, cached, view)
        if (view === 'debug') void this.ensureTrajectory()
        void this.revalidate(sessionId, view)
        return
      }
      if (needSwap) {
        this.loadGen += 1
        // 有上一段内容时先保留画面，只换 sessionId；无缓存清空会闪 EmptyHero
        if (this.value.sessionId && (this.value.nodes.length > 0 || this.value.events.length > 0)) {
          this.replace({
            sessionId,
            trajectory: [],
            project: listedProject,
            view,
            focusCallId: view === 'chat' ? undefined : this.value.focusCallId,
            error: undefined,
            ...this.busyFlagsFor(sessionId),
            loadingOlder: false,
            trajectoryHasMore: false,
            trajectoryLoading: false,
            switchingSession: true,
          })
        } else {
          this.replace({
            sessionId,
            events: [],
            nodes: [],
            trajectory: [],
            project: listedProject,
            view,
            focusCallId: view === 'chat' ? undefined : this.value.focusCallId,
            error: undefined,
            ...this.busyFlagsFor(sessionId),
            hasMoreOlder: false,
            loadingOlder: false,
            trajectoryHasMore: false,
            trajectoryLoading: false,
            totalTurns: 0,
            switchingSession: true,
          })
        }
        if (view === 'debug') void this.ensureTrajectory()
        void this.revalidate(sessionId, view)
        return
      }
    }

    // wait：发送后等同会话刷新，必须等网络；切会话时也先换目标再 await
    this.loadGen += 1
    if (needSwap) {
      if (cached) {
        this.touchCache(sessionId)
        this.applyCached(sessionId, cached, view)
      } else if (this.value.sessionId && (this.value.nodes.length > 0 || this.value.events.length > 0)) {
        this.replace({
          sessionId,
          trajectory: [],
          project: listedProject,
          view,
          focusCallId: view === 'chat' ? undefined : this.value.focusCallId,
          error: undefined,
          ...this.busyFlagsFor(sessionId),
          loadingOlder: false,
          trajectoryHasMore: false,
          trajectoryLoading: false,
          switchingSession: true,
        })
      } else {
        this.replace({
          sessionId,
          events: [],
          nodes: [],
          trajectory: [],
          project: listedProject,
          view,
          focusCallId: view === 'chat' ? undefined : this.value.focusCallId,
          error: undefined,
          ...this.busyFlagsFor(sessionId),
          hasMoreOlder: false,
          loadingOlder: false,
          trajectoryHasMore: false,
          trajectoryLoading: false,
          totalTurns: 0,
          switchingSession: true,
        })
      }
    }
    await this.revalidate(sessionId, view)
    if (view === 'debug') await this.ensureTrajectory()
  }

  /** 静默拉取并套用；若用户已切走则丢弃 */
  private async revalidate(sessionId: string, view: ConversationView) {
    const gen = this.loadGen
    try {
      const res = await fetch(`/api/sessions/${sessionId}?turns=${SESSION_LOAD_TURNS}`)
      if (gen !== this.loadGen || this.value.sessionId !== sessionId) return
      if (!res.ok) {
        if (res.status === 404) {
          this.replace({
            error: `加载 session 失败：${res.status}`,
            sessionId: null,
            events: [],
            nodes: [],
            trajectory: [],
            view: 'chat',
            focusCallId: undefined,
            hasMoreOlder: false,
            totalTurns: 0,
            switchingSession: false,
          })
        }
        return
      }
      const body = (await res.json()) as SessionPayload
      if (gen !== this.loadGen || this.value.sessionId !== sessionId) return
      const events = compactSessionEvents(Array.isArray(body.events) ? body.events : [])
      const byTurn = body.dispatchedUsageByTurn ?? {}
      const tasksByTurn = body.dispatchedTasksByTurn ?? {}
      const dispatchedUsage = body.dispatchedUsage
      const nodes = this.buildNodes(events, byTurn)
      const hasMoreOlder = Boolean(body.hasMore)
      const totalTurns = typeof body.totalTurns === 'number' ? body.totalTurns : 0
      const sameLen = events.length === this.value.events.length
      const sameTail =
        sameLen &&
        events.at(-1)?.seq === this.value.events.at(-1)?.seq &&
        events.at(-1)?.ts === this.value.events.at(-1)?.ts
      this.putCache(sessionId, {
        events,
        nodes,
        project: body.project,
        hasMoreOlder,
        totalTurns,
        dispatchedUsageByTurn: byTurn,
        dispatchedTasksByTurn: tasksByTurn,
        ...(dispatchedUsage ? { dispatchedUsage } : {}),
      })
      // 切会话 hold 期间即使 tail「碰巧相同」也必须落地，否则会一直停在上一段画面
      if (
        !this.value.switchingSession &&
        sameTail &&
        body.project?.path === this.value.project?.path &&
        this.value.totalTurns === totalTurns
      ) {
        this.replace({
          dispatchedUsageByTurn: byTurn,
          dispatchedTasksByTurn: tasksByTurn,
          dispatchedUsage,
          nodes,
        })
        this.syncDispatchedPoll()
        return
      }
      this.replace({
        sessionId: body.id || sessionId,
        events,
        nodes,
        project: body.project,
        hasMoreOlder,
        totalTurns,
        dispatchedUsageByTurn: byTurn,
        dispatchedTasksByTurn: tasksByTurn,
        dispatchedUsage,
        trajectory: view === 'debug' ? this.value.trajectory : [],
        switchingSession: false,
        error: undefined,
      })
      this.syncDispatchedPoll()
      if (view === 'debug') void this.ensureTrajectory()
      void this.refreshInbox(sessionId)
    } catch {
      /* 静默 */
    }
  }

  private applyCached(sessionId: string, cached: SessionCacheEntry, view: ConversationView) {
    this.replace({
      sessionId,
      events: cached.events,
      nodes: cached.nodes,
      trajectory: [],
      project: cached.project,
      view,
      focusCallId: view === 'chat' ? undefined : this.value.focusCallId,
      error: undefined,
      inbox: sessionId === this.value.sessionId ? this.value.inbox : [],
      ...this.busyFlagsFor(sessionId),
      hasMoreOlder: cached.hasMoreOlder,
      loadingOlder: false,
      trajectoryHasMore: false,
      trajectoryLoading: false,
      totalTurns: cached.totalTurns,
      dispatchedUsageByTurn: cached.dispatchedUsageByTurn,
      dispatchedTasksByTurn: cached.dispatchedTasksByTurn,
      dispatchedUsage: cached.dispatchedUsage,
      switchingSession: false,
    })
    this.syncDispatchedPoll()
    void this.refreshInbox(sessionId)
  }

  private stashCurrent() {
    const id = this.value.sessionId
    if (!id) return
    this.putCache(id, {
      events: this.value.events,
      nodes: this.value.nodes,
      project: this.value.project,
      hasMoreOlder: this.value.hasMoreOlder,
      totalTurns: this.value.totalTurns,
      dispatchedUsageByTurn: this.value.dispatchedUsageByTurn,
      dispatchedTasksByTurn: this.value.dispatchedTasksByTurn,
      ...(this.value.dispatchedUsage ? { dispatchedUsage: this.value.dispatchedUsage } : {}),
    })
  }

  private putCache(id: string, entry: SessionCacheEntry) {
    if (this.cache.has(id)) this.cacheOrder = this.cacheOrder.filter((item) => item !== id)
    this.cache.set(id, entry)
    this.cacheOrder.push(id)
    while (this.cacheOrder.length > SESSION_CACHE_MAX) {
      const evict = this.cacheOrder.shift()
      if (evict) this.cache.delete(evict)
    }
  }

  private touchCache(id: string) {
    if (!this.cache.has(id)) return
    this.cacheOrder = this.cacheOrder.filter((item) => item !== id)
    this.cacheOrder.push(id)
  }

  private dropCache(id: string) {
    this.cache.delete(id)
    this.cacheOrder = this.cacheOrder.filter((item) => item !== id)
  }

  /** 上滑加载更早 chat turn；返回是否真正拉到了数据 */
  async loadOlder(): Promise<boolean> {
    const { sessionId, hasMoreOlder, loadingOlder, events } = this.value
    if (!sessionId || !hasMoreOlder || loadingOlder) return false
    const beforeSeq = events[0]?.seq
    if (beforeSeq == null) return false
    this.replace({ loadingOlder: true })
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/events?beforeSeq=${beforeSeq}&turns=${SESSION_TAIL_TURNS}`,
      )
      if (!res.ok) throw new Error(`加载更早事件失败：${res.status}`)
      const body = (await res.json()) as SessionPayload
      const older = compactSessionEvents(Array.isArray(body.events) ? body.events : [])
      if (!older.length) {
        this.replace({ hasMoreOlder: false, loadingOlder: false })
        return false
      }
      const seen = new Set(events.map((event) => event.seq))
      const merged = [...older.filter((event) => !seen.has(event.seq)), ...events].sort(
        (a, b) => a.seq - b.seq,
      )
      this.replace({
        events: merged,
        nodes: this.buildNodes(merged),
        hasMoreOlder: Boolean(body.hasMore),
        loadingOlder: false,
        totalTurns: typeof body.totalTurns === 'number' ? body.totalTurns : this.value.totalTurns,
      })
      return true
    } catch (error) {
      this.replace({ loadingOlder: false, error: String(error) })
      return false
    }
  }

  /** 进入 Trajectory：只拉轻量 rows 索引，不拉全文 events。 */
  async ensureTrajectory() {
    const sessionId = this.value.sessionId
    if (!sessionId) return
    if (this.value.trajectoryLoading) return
    this.replace({ trajectoryLoading: true, view: 'debug' })
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/trajectory?turns=${TRAJECTORY_TAIL_TURNS}`,
      )
      if (!res.ok) throw new Error(`加载 trajectory 失败：${res.status}`)
      const body = (await res.json()) as TrajectoryPayload
      this.replace({
        trajectory: Array.isArray(body.rows) ? body.rows : [],
        trajectoryHasMore: Boolean(body.hasMore),
        trajectoryLoading: false,
        totalTurns: typeof body.totalTurns === 'number' ? body.totalTurns : this.value.totalTurns,
        view: 'debug',
      })
    } catch (error) {
      this.replace({ trajectoryLoading: false, error: String(error) })
    }
  }

  async refreshTrajectoryIndex() {
    const sessionId = this.value.sessionId
    if (!sessionId || this.value.view !== 'debug') return
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/trajectory?turns=${TRAJECTORY_TAIL_TURNS}`,
      )
      if (!res.ok) return
      const body = (await res.json()) as TrajectoryPayload
      this.replace({
        trajectory: Array.isArray(body.rows) ? body.rows : [],
        trajectoryHasMore: Boolean(body.hasMore),
        totalTurns: typeof body.totalTurns === 'number' ? body.totalTurns : this.value.totalTurns,
      })
    } catch {
      /* ignore */
    }
  }

  async loadOlderTrajectory(): Promise<boolean> {
    const { sessionId, trajectoryHasMore, trajectoryLoading, trajectory } = this.value
    if (!sessionId || !trajectoryHasMore || trajectoryLoading) return false
    const beforeSeq = trajectory[0]?.seq
    if (beforeSeq == null) return false
    this.replace({ trajectoryLoading: true })
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/trajectory?beforeSeq=${beforeSeq}&turns=${TRAJECTORY_TAIL_TURNS}`,
      )
      if (!res.ok) throw new Error(`加载更早 trajectory 失败：${res.status}`)
      const body = (await res.json()) as TrajectoryPayload
      const older = Array.isArray(body.rows) ? body.rows : []
      if (!older.length) {
        this.replace({ trajectoryHasMore: false, trajectoryLoading: false })
        return false
      }
      const seen = new Set(trajectory.map((row) => row.seq))
      const merged = [...older.filter((row) => !seen.has(row.seq)), ...trajectory].sort(
        (a, b) => a.seq - b.seq,
      )
      this.replace({
        trajectory: merged,
        trajectoryHasMore: Boolean(body.hasMore),
        trajectoryLoading: false,
        totalTurns: typeof body.totalTurns === 'number' ? body.totalTurns : this.value.totalTurns,
      })
      return true
    } catch (error) {
      this.replace({ trajectoryLoading: false, error: String(error) })
      return false
    }
  }

  /** 详情懒加载：单条事件全文 */
  async fetchEventDetail(seq: number): Promise<SessionEvent | null> {
    const sessionId = this.value.sessionId
    if (!sessionId) return null
    const res = await fetch(`/api/sessions/${sessionId}/events/${seq}`)
    if (!res.ok) throw new Error(`加载事件失败：${res.status}`)
    const body = (await res.json()) as { event?: SessionEvent }
    return body.event ?? null
  }

  /** 详情懒加载：assistant/message 的 derived request */
  async fetchEventRequest(seq: number): Promise<DerivedMessage[]> {
    const sessionId = this.value.sessionId
    if (!sessionId) return []
    const res = await fetch(`/api/sessions/${sessionId}/events/${seq}/request`)
    if (!res.ok) throw new Error(`加载 request 失败：${res.status}`)
    const body = (await res.json()) as { messages?: DerivedMessage[] }
    return Array.isArray(body.messages) ? body.messages : []
  }

  setProjectMeta(project?: { name: string; path?: string; boundAt: number }) {
    const current = this.value.project
    const sameProject =
      current === project ||
      (Boolean(current) === Boolean(project) &&
        current?.name === project?.name &&
        current?.path === project?.path &&
        current?.boundAt === project?.boundAt)
    const sessionId = this.value.sessionId
    const sessionsUnchanged =
      !sessionId ||
      this.value.sessions.every((item) => {
        if (item.id !== sessionId) return true
        const p = item.project
        return (
          p === project ||
          (Boolean(p) === Boolean(project) &&
            p?.name === project?.name &&
            p?.path === project?.path &&
            p?.boundAt === project?.boundAt)
        )
      })
    if (sameProject && sessionsUnchanged) return

    const sessions = sessionId
      ? this.value.sessions.map((item) =>
          item.id === sessionId ? { ...item, project } : item,
        )
      : this.value.sessions
    this.replace({ project, sessions })
  }

  async forkCurrent() {
    const sessionId = this.value.sessionId
    if (!sessionId) throw new Error('no session')
    const res = await fetch(`/api/sessions/${sessionId}/fork`, { method: 'POST' })
    const body = (await res.json()) as { id?: string; error?: string }
    if (!res.ok || !body.id) throw new Error(body.error || 'fork failed')
    await this.load(body.id, { view: 'chat' })
    return body.id
  }

  async deleteSession(id: string) {
    const prevSessions = this.value.sessions
    const wasActive = this.value.sessionId === id
    // 乐观更新：先从侧栏拿掉，避免等网络才「卡一下消失」
    this.dropCache(id)
    const busySessions = { ...this.value.busySessions }
    delete busySessions[id]
    this.replace({
      sessions: prevSessions.filter((item) => item.id !== id),
      busySessions,
      ...(wasActive
        ? {
            sessionId: null,
            events: [],
            nodes: [],
            trajectory: [],
            pending: false,
            agentStatus: 'idle' as const,
            project: undefined,
            hasMoreOlder: false,
            loadingOlder: false,
            trajectoryHasMore: false,
            trajectoryLoading: false,
            totalTurns: 0,
            switchingSession: false,
            error: undefined,
          }
        : {}),
    })

    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
      const body = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(body.error || `删除失败：${res.status}`)
    } catch (error) {
      this.replace({ sessions: prevSessions, error: String(error) })
      throw error
    }

    await this.refreshSessions()
    if (!wasActive) return
    const next = this.value.sessions[0]?.id
    if (next) {
      await this.load(next, { view: 'chat' })
      return
    }
    this.loadGen += 1
    this.replace({
      sessionId: null,
      events: [],
      nodes: [],
      trajectory: [],
      approvals: [],
      pending: false,
      agentStatus: 'idle',
      inbox: [],
      view: 'chat',
      focusCallId: undefined,
      project: undefined,
      hasMoreOlder: false,
      loadingOlder: false,
      trajectoryHasMore: false,
      trajectoryLoading: false,
      totalTurns: 0,
      switchingSession: false,
      error: undefined,
    })
  }

  async send(text: string, kind: 'wake' | 'inject' = 'wake', extraTools: string[] = []) {
    const content = text.trim()
    if (!content) return
    const sessionId = await this.ensureSession()
    const tools = [...new Set(extraTools.map((name) => name.trim()).filter(Boolean))]
    const busy = this.value.pending || this.value.agentStatus === 'running'
    const hasWake = this.value.inbox.some((item) => item.kind === 'wake')
    // 忙碌且已有 wake：再发 → inject；否则 wake。忙碌时 wait:false 立刻返回。
    const effectiveKind: 'wake' | 'inject' =
      kind === 'inject' || (kind === 'wake' && busy && hasWake) ? 'inject' : 'wake'
    const body: Record<string, unknown> =
      effectiveKind === 'inject'
        ? { text: content, kind: 'inject', ...(tools.length ? { extraTools: tools } : {}) }
        : {
            text: content,
            ...(busy ? { wait: false } : {}),
            ...(tools.length ? { extraTools: tools } : {}),
          }

    if (effectiveKind === 'inject') {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { error?: string; inbox?: InboxQueueItem[] }
      if (!res.ok) {
        this.replace({ error: data.error || `注入失败：${res.status}` })
        throw new Error(data.error || `注入失败：${res.status}`)
      }
      if (Array.isArray(data.inbox)) this.setInbox(data.inbox, sessionId)
      return
    }

    this.setAgentStatus('running', undefined, sessionId)
    this.replace({ error: undefined })
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as {
        error?: string
        sessionId?: string
        text?: string
        queued?: boolean
        inbox?: InboxQueueItem[]
      }
      if (!res.ok) throw new Error(data.error || `发送失败：${res.status}`)
      if (Array.isArray(data.inbox)) this.setInbox(data.inbox, data.sessionId ?? sessionId)
      if (data.queued) {
        // 已入队：不阻塞等回合结束，状态交给 WS
        return
      }
      if (data.sessionId && data.sessionId !== sessionId) {
        await this.load(data.sessionId, { view: 'chat', wait: true })
      } else {
        await this.load(sessionId, { view: this.value.view, wait: true })
      }
      if (typeof data.text === 'string' && data.text.startsWith('模型调用失败：')) {
        this.replace({ error: data.text })
      }
    } catch (error) {
      try {
        await this.load(sessionId, { view: this.value.view, wait: true })
      } catch {
        /* 加载失败时仍展示下方 error */
      }
      this.setAgentStatus('idle', undefined, sessionId)
      this.replace({ error: String(error) })
      throw error
    }
    // 成功后不要在 finally 里强行 idle：agent 仍在跑，状态交给 WS agent/status
  }

  setInbox(inbox: InboxQueueItem[], sessionId?: string) {
    const id = sessionId ?? this.value.sessionId
    if (id && this.value.sessionId && id !== this.value.sessionId) return
    const next = Array.isArray(inbox) ? inbox : []
    if (JSON.stringify(next) === JSON.stringify(this.value.inbox)) return
    this.replace({ inbox: next })
  }

  async refreshInbox(sessionId = this.value.sessionId) {
    if (!sessionId) {
      this.replace({ inbox: [] })
      return
    }
    try {
      const res = await fetch(`/api/sessions/${sessionId}/inbox`)
      if (!res.ok || this.value.sessionId !== sessionId) return
      const body = (await res.json()) as { inbox?: InboxQueueItem[] }
      this.setInbox(Array.isArray(body.inbox) ? body.inbox : [], sessionId)
    } catch {
      /* 静默 */
    }
  }

  async cancel() {
    const sessionId = this.value.sessionId
    if (!sessionId) return
    await fetch(`/api/sessions/${sessionId}/cancel`, { method: 'POST' })
    this.setAgentStatus('idle', undefined, sessionId)
  }

  async decideApproval(id: string, allow: boolean) {
    await fetch(`/api/approvals/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ allow }),
    })
    this.removeApproval(id)
  }

  private replace(patch: Partial<SessionViewState>) {
    this.value = { ...this.value, ...patch }
    for (const fn of this.listeners) fn()
  }
}

function upsertEvent(events: SessionEvent[], event: SessionEvent) {
  if (events.some((item) => item.seq === event.seq)) return events
  if (event.type === 'assistant/chunk') {
    const last = events.at(-1)
    if (last?.type === 'assistant/chunk') {
      return [
        ...events.slice(0, -1),
        { ...last, text: last.text + event.text, ts: event.ts },
      ]
    }
  }
  if (event.type === 'assistant/message') {
    const last = events.at(-1)
    if (last?.type === 'assistant/chunk') {
      return [...events.slice(0, -1), event]
    }
  }
  return [...events, event].sort((a, b) => a.seq - b.seq)
}

function patchStreamingNodes(
  nodes: ChatNode[],
  chunk: Extract<SessionEvent, { type: 'assistant/chunk' }>,
): ChatNode[] {
  const last = nodes.at(-1)
  if (last?.kind === 'reply') {
    const parts = [...last.parts]
    const lastPart = parts.at(-1)
    if (lastPart?.kind === 'assistant' && lastPart.streaming) {
      if (lastPart.text === chunk.text) return nodes
      parts[parts.length - 1] = { ...lastPart, text: chunk.text, streaming: true }
    } else {
      parts.push({ id: `a-${chunk.seq}`, kind: 'assistant', text: chunk.text, streaming: true })
    }
    const copyText = parts
      .filter((part) => part.kind === 'assistant')
      .map((part) => (part.kind === 'assistant' ? part.text.trim() : ''))
      .filter(Boolean)
      .join('\n\n')
    return [...nodes.slice(0, -1), { ...last, parts, copyText, streaming: true, finished: false }]
  }
  return [
    ...nodes,
    {
      id: `r-${chunk.seq}`,
      kind: 'reply',
      parts: [{ id: `a-${chunk.seq}`, kind: 'assistant', text: chunk.text, streaming: true }],
      copyText: chunk.text,
      streaming: true,
      finished: false,
    },
  ]
}

export function bindSessionView(source: SessionViewService) {
  return function useSessionView<S>(sel: (state: SessionViewState) => S): S {
    return useSyncExternalStore(source.subscribe, () => sel(source.get()), () => sel(source.get()))
  }
}

export const name = 'session-view'
export const inject = [] as const

export function apply(ctx: Context) {
  new SessionViewService(ctx)
}
