import { useSyncExternalStore } from 'react'
import { Service, type Context } from 'cordis'
import {
  compactSessionEvents,
  projectNodes,
  type ChatNode,
  type DerivedMessage,
  type SessionEvent,
  type TrajectoryRow,
} from './session-project.ts'
import type { AppRoute } from './session-route.ts'

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
  project?: { name: string; path?: string; boundAt: number }
}

export type ConversationView = 'chat' | 'trajectory'
export type ApprovalMode = 'auto' | 'hold'

/** 与 host DEFAULT_TAIL_TURNS / DEFAULT_TRAJECTORY_TURNS 对齐 */
export const SESSION_TAIL_TURNS = 24
export const TRAJECTORY_TAIL_TURNS = 48

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
  approvalMode: 'auto',
  approvals: [],
  hasMoreOlder: false,
  loadingOlder: false,
  trajectoryHasMore: false,
  trajectoryLoading: false,
  totalTurns: 0,
}

type SessionPayload = {
  id: string
  events: SessionEvent[]
  hasMore?: boolean
  totalTurns?: number
  totalEvents?: number
  project?: { name: string; path?: string; boundAt: number }
}

type TrajectoryPayload = {
  id: string
  rows?: TrajectoryRow[]
  hasMore?: boolean
  totalTurns?: number
}

export class SessionViewService extends Service {
  private value: SessionViewState = empty
  private listeners = new Set<() => void>()

  constructor(ctx: Context) {
    super(ctx, 'sessionView')
    void this.refreshSessions()
    void this.refreshApprovals()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  get = () => this.value

  setView(view: ConversationView) {
    this.replace({ view, focusCallId: view === 'chat' ? undefined : this.value.focusCallId })
    if (view === 'trajectory') void this.ensureTrajectory()
  }

  inspectCall(callId: string) {
    this.replace({ view: 'trajectory', focusCallId: callId })
    void this.ensureTrajectory()
  }

  /** URL → 状态：只由路由层调用，不回写 URL */
  async applyRoute(route: AppRoute) {
    if (route.kind === 'module') {
      return
    }
    if (route.kind === 'home') {
      if (!this.value.sessionId && this.value.view === 'chat') return
      this.replace({
        sessionId: null,
        events: [],
        nodes: [],
        trajectory: [],
        view: 'chat',
        focusCallId: undefined,
        pending: false,
        agentStatus: 'idle',
        project: undefined,
        hasMoreOlder: false,
        loadingOlder: false,
        trajectoryHasMore: false,
        trajectoryLoading: false,
        totalTurns: 0,
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
        })
        throw error
      }
    } else if (this.value.view !== route.view) {
      this.replace({
        view: route.view,
        focusCallId: route.view === 'chat' ? undefined : this.value.focusCallId,
      })
    }
    if (route.view === 'trajectory') await this.ensureTrajectory()
  }

  ingest(sessionId: string, event: SessionEvent) {
    if (this.value.sessionId && this.value.sessionId !== sessionId) {
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
      nodes: projectNodes(events),
      error: undefined,
    })
    // Trajectory 索引走独立接口；运行中只做轻量刷新，不塞全文 events
    if (this.value.view === 'trajectory') void this.refreshTrajectoryIndex()
    void this.refreshSessions()
  }

  private ingestChunk(sessionId: string, event: Extract<SessionEvent, { type: 'assistant/chunk' }>) {
    const events = upsertEvent(this.value.sessionId === sessionId ? this.value.events : [], event)
    const chunk = events.at(-1)
    const nodes =
      chunk?.type === 'assistant/chunk'
        ? patchStreamingNodes(this.value.nodes, chunk)
        : projectNodes(events)
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

  setAgentStatus(status: 'idle' | 'running', step?: number) {
    if (status === 'running') {
      this.replace({ agentStatus: 'running', agentStep: step, pending: true })
      return
    }
    this.replace({ agentStatus: 'idle', agentStep: step })
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
      this.replace({ sessions: Array.isArray(body.sessions) ? body.sessions : [] })
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
      this.replace({
        approvalMode: body.mode === 'hold' ? 'hold' : 'auto',
        approvals: Array.isArray(body.pending) ? body.pending : [],
      })
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

  async newSession() {
    const res = await fetch('/api/sessions', { method: 'POST' })
    const body = (await res.json()) as { id?: string }
    if (!body.id) throw new Error('无法创建 session')
    await this.load(body.id, { view: 'chat' })
    await this.refreshSessions()
    return body.id
  }

  async ensureSession() {
    if (this.value.sessionId) return this.value.sessionId
    return this.newSession()
  }

  async load(sessionId: string, options: { view?: ConversationView } = {}) {
    const view = options.view ?? this.value.view
    const res = await fetch(`/api/sessions/${sessionId}?turns=${SESSION_TAIL_TURNS}`)
    if (!res.ok) throw new Error(`加载 session 失败：${res.status}`)
    const body = (await res.json()) as SessionPayload
    const events = compactSessionEvents(Array.isArray(body.events) ? body.events : [])
    this.replace({
      sessionId: body.id,
      events,
      nodes: projectNodes(events),
      trajectory: [],
      project: body.project,
      view,
      focusCallId: view === 'chat' ? undefined : this.value.focusCallId,
      error: undefined,
      pending: false,
      agentStatus: 'idle',
      hasMoreOlder: Boolean(body.hasMore),
      loadingOlder: false,
      trajectoryHasMore: false,
      trajectoryLoading: false,
      totalTurns: typeof body.totalTurns === 'number' ? body.totalTurns : 0,
    })
    if (view === 'trajectory') await this.ensureTrajectory()
    void this.refreshSessions()
    void this.refreshApprovals()
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
        nodes: projectNodes(merged),
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
    this.replace({ trajectoryLoading: true, view: 'trajectory' })
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
        view: 'trajectory',
      })
    } catch (error) {
      this.replace({ trajectoryLoading: false, error: String(error) })
    }
  }

  async refreshTrajectoryIndex() {
    const sessionId = this.value.sessionId
    if (!sessionId || this.value.view !== 'trajectory') return
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
    this.replace({ project })
    const sessions = this.value.sessions.map((item) =>
      item.id === this.value.sessionId ? { ...item, project } : item,
    )
    this.replace({ sessions })
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
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    const body = (await res.json()) as { ok?: boolean; error?: string }
    if (!res.ok) throw new Error(body.error || `删除失败：${res.status}`)
    const wasActive = this.value.sessionId === id
    await this.refreshSessions()
    if (!wasActive) return
    const next = this.value.sessions[0]?.id
    if (next) {
      await this.load(next, { view: 'chat' })
      return
    }
    this.replace({
      sessionId: null,
      events: [],
      nodes: [],
      trajectory: [],
      approvals: [],
      pending: false,
      agentStatus: 'idle',
      view: 'chat',
      focusCallId: undefined,
      project: undefined,
      hasMoreOlder: false,
      loadingOlder: false,
      trajectoryHasMore: false,
      trajectoryLoading: false,
      totalTurns: 0,
      error: undefined,
    })
  }

  async send(text: string, kind: 'wake' | 'inject' = 'wake') {
    const content = text.trim()
    if (!content) return
    const sessionId = await this.ensureSession()
    if (kind === 'inject') {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: content, kind: 'inject' }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        this.replace({ error: data.error || `注入失败：${res.status}` })
        throw new Error(data.error || `注入失败：${res.status}`)
      }
      return
    }
    this.replace({ pending: true, agentStatus: 'running', error: undefined })
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: content }),
      })
      const data = (await res.json()) as { error?: string; sessionId?: string; text?: string }
      if (!res.ok) throw new Error(data.error || `发送失败：${res.status}`)
      if (data.sessionId && data.sessionId !== sessionId) await this.load(data.sessionId, { view: 'chat' })
      else await this.load(sessionId, { view: this.value.view })
      if (typeof data.text === 'string' && data.text.startsWith('模型调用失败：')) {
        this.replace({ error: data.text })
      }
    } catch (error) {
      try {
        await this.load(sessionId, { view: this.value.view })
      } catch {
        /* 加载失败时仍展示下方 error */
      }
      this.replace({ error: String(error), pending: false, agentStatus: 'idle' })
      throw error
    } finally {
      this.replace({ pending: false, agentStatus: 'idle' })
    }
  }

  async cancel() {
    const sessionId = this.value.sessionId
    if (!sessionId) return
    await fetch(`/api/sessions/${sessionId}/cancel`, { method: 'POST' })
    this.replace({ pending: false, agentStatus: 'idle' })
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
  if (last?.kind === 'assistant' && last.streaming) {
    if (last.text === chunk.text) return nodes
    return [...nodes.slice(0, -1), { ...last, text: chunk.text, streaming: true }]
  }
  return [...nodes, { id: `a-${chunk.seq}`, kind: 'assistant', text: chunk.text, streaming: true }]
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
