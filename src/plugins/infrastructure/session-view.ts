import { useSyncExternalStore } from 'react'
import { Service, type Context } from 'cordis'
import {
  projectNodes,
  projectTrajectory,
  type ChatNode,
  type SessionEvent,
  type TrajectoryRow,
} from './session-project.ts'
import { buildAppPath, parseAppPath, routeFromState } from './session-route.ts'

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
}

export type ConversationView = 'chat' | 'trajectory'
export type ApprovalMode = 'auto' | 'hold'

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
}

export class SessionViewService extends Service {
  private value: SessionViewState = empty
  private listeners = new Set<() => void>()
  /** popstate / hydrate 期间禁止再 push，避免循环 */
  private suppressUrl = false

  constructor(ctx: Context) {
    super(ctx, 'sessionView')
    void this.refreshSessions()
    void this.refreshApprovals()
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', () => {
        void this.hydrateFromLocation({ replace: true })
      })
      void this.hydrateFromLocation({ replace: true })
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  get = () => this.value

  setView(view: ConversationView) {
    this.replace({ view, focusCallId: view === 'chat' ? undefined : this.value.focusCallId })
    this.syncUrl()
  }

  inspectCall(callId: string) {
    this.replace({ view: 'trajectory', focusCallId: callId })
    this.syncUrl()
  }

  ingest(sessionId: string, event: SessionEvent) {
    if (this.value.sessionId && this.value.sessionId !== sessionId) {
      void this.refreshSessions()
      return
    }
    const becameActive = this.value.sessionId !== sessionId
    const events = upsertEvent(this.value.sessionId === sessionId ? this.value.events : [], event)
    this.replace({
      sessionId,
      events,
      nodes: projectNodes(events),
      trajectory: projectTrajectory(events),
      error: undefined,
    })
    if (becameActive) this.syncUrl()
    void this.refreshSessions()
  }

  setAgentStatus(status: 'idle' | 'running', step?: number) {
    this.replace({ agentStatus: status, agentStep: step, pending: status === 'running' || this.value.pending })
    if (status === 'idle') this.replace({ pending: false })
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
    await this.load(body.id)
    this.replace({ view: 'chat', focusCallId: undefined })
    this.syncUrl()
    await this.refreshSessions()
    return body.id
  }

  async ensureSession() {
    if (this.value.sessionId) return this.value.sessionId
    return this.newSession()
  }

  async load(sessionId: string) {
    const res = await fetch(`/api/sessions/${sessionId}`)
    if (!res.ok) throw new Error(`加载 session 失败：${res.status}`)
    const body = (await res.json()) as { id: string; events: SessionEvent[] }
    const events = Array.isArray(body.events) ? body.events : []
    this.replace({
      sessionId: body.id,
      events,
      nodes: projectNodes(events),
      trajectory: projectTrajectory(events),
      error: undefined,
      pending: false,
      agentStatus: 'idle',
    })
    this.syncUrl()
    await this.refreshSessions()
    await this.refreshApprovals()
  }

  async forkCurrent() {
    const sessionId = this.value.sessionId
    if (!sessionId) throw new Error('no session')
    const res = await fetch(`/api/sessions/${sessionId}/fork`, { method: 'POST' })
    const body = (await res.json()) as { id?: string; error?: string }
    if (!res.ok || !body.id) throw new Error(body.error || 'fork failed')
    await this.load(body.id)
    this.replace({ view: 'chat' })
    this.syncUrl()
    return body.id
  }

  async hydrateFromLocation(options: { replace?: boolean } = {}) {
    if (typeof window === 'undefined') return
    const route = parseAppPath(window.location.pathname)
    this.suppressUrl = true
    try {
      if (route.kind === 'home') {
        if (this.value.sessionId) {
          this.replace({
            sessionId: null,
            events: [],
            nodes: [],
            trajectory: [],
            view: 'chat',
            focusCallId: undefined,
            pending: false,
            agentStatus: 'idle',
            error: undefined,
          })
        }
        return
      }
      if (this.value.sessionId !== route.sessionId) await this.load(route.sessionId)
      if (this.value.view !== route.view) {
        this.replace({ view: route.view, focusCallId: route.view === 'chat' ? undefined : this.value.focusCallId })
      }
    } catch (error) {
      this.replace({ error: String(error), sessionId: null, events: [], nodes: [], trajectory: [], view: 'chat' })
      if (options.replace !== false) {
        window.history.replaceState(null, '', '/')
      }
    } finally {
      this.suppressUrl = false
      if (options.replace) this.replaceUrl()
      else this.syncUrl()
    }
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
      const data = (await res.json()) as { error?: string; sessionId?: string }
      if (!res.ok) throw new Error(data.error || `发送失败：${res.status}`)
      if (data.sessionId && data.sessionId !== sessionId) await this.load(data.sessionId)
      else await this.load(sessionId)
    } catch (error) {
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

  private syncUrl() {
    if (this.suppressUrl || typeof window === 'undefined') return
    const path = buildAppPath(routeFromState(this.value.sessionId, this.value.view))
    if (window.location.pathname === path) return
    window.history.pushState({ sessionId: this.value.sessionId, view: this.value.view }, '', path)
  }

  private replaceUrl() {
    if (typeof window === 'undefined') return
    const path = buildAppPath(routeFromState(this.value.sessionId, this.value.view))
    if (window.location.pathname === path) return
    window.history.replaceState({ sessionId: this.value.sessionId, view: this.value.view }, '', path)
  }

  private replace(patch: Partial<SessionViewState>) {
    this.value = { ...this.value, ...patch }
    for (const fn of this.listeners) fn()
  }
}

function upsertEvent(events: SessionEvent[], event: SessionEvent) {
  if (events.some((item) => item.seq === event.seq)) return events
  return [...events, event].sort((a, b) => a.seq - b.seq)
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
