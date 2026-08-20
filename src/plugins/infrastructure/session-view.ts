import { useSyncExternalStore } from 'react'
import { Service, type Context } from 'cordis'
import {
  projectNodes,
  projectTrajectory,
  type ChatNode,
  type SessionEvent,
  type TrajectoryRow,
} from './session-project.ts'

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
  approvals: [],
}

export class SessionViewService extends Service {
  private value: SessionViewState = empty
  private listeners = new Set<() => void>()

  constructor(ctx: Context) {
    super(ctx, 'sessionView')
    void this.refreshSessions()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  get = () => this.value

  setView(view: ConversationView) {
    this.replace({ view, focusCallId: view === 'chat' ? undefined : this.value.focusCallId })
  }

  inspectCall(callId: string) {
    this.replace({ view: 'trajectory', focusCallId: callId })
  }

  ingest(sessionId: string, event: SessionEvent) {
    if (this.value.sessionId && this.value.sessionId !== sessionId) {
      void this.refreshSessions()
      return
    }
    const events = upsertEvent(this.value.sessionId === sessionId ? this.value.events : [], event)
    this.replace({
      sessionId,
      events,
      nodes: projectNodes(events),
      trajectory: projectTrajectory(events),
      error: undefined,
    })
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

  async newSession() {
    const res = await fetch('/api/sessions', { method: 'POST' })
    const body = (await res.json()) as { id?: string }
    if (!body.id) throw new Error('无法创建 session')
    await this.load(body.id)
    this.replace({ view: 'chat', focusCallId: undefined, approvals: [] })
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
      approvals: [],
    })
    await this.refreshSessions()
  }

  async forkCurrent() {
    const sessionId = this.value.sessionId
    if (!sessionId) throw new Error('no session')
    const res = await fetch(`/api/sessions/${sessionId}/fork`, { method: 'POST' })
    const body = (await res.json()) as { id?: string; error?: string }
    if (!res.ok || !body.id) throw new Error(body.error || 'fork failed')
    await this.load(body.id)
    this.replace({ view: 'chat' })
    return body.id
  }

  async send(text: string) {
    const content = text.trim()
    if (!content) return
    const sessionId = await this.ensureSession()
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
