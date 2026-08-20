import { useSyncExternalStore } from 'react'
import { Service, type Context } from 'cordis'
import {
  compactSessionEvents,
  projectNodes,
  projectTrajectory,
  type ChatNode,
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
  }

  inspectCall(callId: string) {
    this.replace({ view: 'trajectory', focusCallId: callId })
  }

  /** URL → 状态：只由路由层调用，不回写 URL */
  async applyRoute(route: AppRoute) {
    if (route.kind === 'module') {
      // 其它模块不碰 agent session 投影，切回 Agent 时会话仍在。
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
        error: undefined,
      })
      return
    }
    if (this.value.sessionId !== route.sessionId) {
      try {
        await this.load(route.sessionId)
      } catch (error) {
        this.replace({
          error: String(error),
          sessionId: null,
          events: [],
          nodes: [],
          trajectory: [],
          view: 'chat',
          focusCallId: undefined,
        })
        throw error
      }
    }
    if (this.value.view !== route.view) {
      this.replace({
        view: route.view,
        focusCallId: route.view === 'chat' ? undefined : this.value.focusCallId,
      })
    }
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
    // chunk 高频；列表刷新留给 turn/message/tool 等结构化事件
    if (event.type !== 'assistant/chunk') void this.refreshSessions()
  }

  setAgentStatus(status: 'idle' | 'running', step?: number) {
    // pending 由 send()/cancel() 拥有；WS 的 idle 不能提前清掉，否则会像「agent 没响应」
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
    await this.load(body.id)
    this.replace({ view: 'chat', focusCallId: undefined })
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
    const body = (await res.json()) as {
      id: string
      events: SessionEvent[]
      project?: { name: string; path?: string; boundAt: number }
    }
    const events = compactSessionEvents(Array.isArray(body.events) ? body.events : [])
    this.replace({
      sessionId: body.id,
      events,
      nodes: projectNodes(events),
      trajectory: projectTrajectory(events),
      project: body.project,
      error: undefined,
      pending: false,
      agentStatus: 'idle',
    })
    await this.refreshSessions()
    await this.refreshApprovals()
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
    await this.load(body.id)
    this.replace({ view: 'chat' })
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
      await this.load(next)
      this.replace({ view: 'chat', focusCallId: undefined })
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
      if (data.sessionId && data.sessionId !== sessionId) await this.load(data.sessionId)
      else await this.load(sessionId)
      if (typeof data.text === 'string' && data.text.startsWith('模型调用失败：')) {
        this.replace({ error: data.text })
      }
    } catch (error) {
      try {
        await this.load(sessionId)
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
      // 合并连续 delta，保持首条 chunk 的 seq（Chat 流式节点 id 稳定）
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
