import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { LuPanelRightClose, LuRadio, LuWrench } from 'react-icons/lu'
import {
  bindSessionView,
  type SessionViewService,
} from '../infrastructure/session-view.ts'
import { SidebarMascot } from './mascot/sidebar-mascot.tsx'
import { resolveSessionMascot } from './mascot/session-mascot.ts'

type ToolSourceId = 'minimal' | 'live' | 'plugin'
type AgentMode = 'standard' | 'minimal'
type InspectorTab = 'tools' | 'live'

interface InspectorTool {
  name: string
  description: string
  source: ToolSourceId
  active: boolean
  configurable: boolean
}

interface InspectorSource {
  id: ToolSourceId
  label: string
  description: string
}

interface InspectorWorker {
  id: string
  title: string
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

interface InspectorPayload {
  sessionId: string
  type: 'chat' | 'live'
  agentMode: AgentMode
  extraTools: string[]
  sources: InspectorSource[]
  tools: InspectorTool[]
  workers?: InspectorWorker[]
}

const SOURCE_TONE: Record<ToolSourceId, string> = {
  minimal: 'inspector-source-minimal',
  live: 'inspector-source-live',
  plugin: 'inspector-source-plugin',
}

export type SessionInspectorProps = {
  open: boolean
  onClose: () => void
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView: SessionViewService
}

export const SessionInspector = memo(function SessionInspector({
  open,
  onClose,
  useSessionView,
}: SessionInspectorProps) {
  const sessionId = useSessionView((state) => state.sessionId)
  const sessions = useSessionView((state) => state.sessions)
  const sessionType = useMemo(() => {
    const hit = sessions.find((item) => item.id === sessionId)
    return (hit?.type ?? 'chat') as 'chat' | 'live'
  }, [sessionId, sessions])

  const [tab, setTab] = useState<InspectorTab>('tools')
  const [data, setData] = useState<InspectorPayload | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setTab(sessionType === 'live' ? 'live' : 'tools')
  }, [sessionType, sessionId])

  const refresh = useCallback(async () => {
    if (!sessionId || !open) return
    try {
      const res = await fetch(`/api/sessions/${sessionId}/inspector`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as InspectorPayload
      setData(body)
      setError('')
    } catch (err) {
      setError(String(err))
    }
  }, [sessionId, open])

  useEffect(() => {
    if (!open || !sessionId) return
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, 2000)
    return () => window.clearInterval(timer)
  }, [open, sessionId, refresh])

  async function patchConfig(next: { agentMode?: AgentMode; extraTools?: string[] }) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/chat/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error(`保存失败 HTTP ${res.status}`)
      await refresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  function toggleExtra(name: string, checked: boolean) {
    const current = data?.extraTools ?? []
    const next = checked
      ? [...new Set([...current, name])]
      : current.filter((item) => item !== name)
    void patchConfig({ extraTools: next })
  }

  if (!open) return null

  const tools = data?.tools ?? []
  const sources = data?.sources ?? []
  const workers = data?.workers ?? []
  const mode = data?.agentMode ?? 'standard'

  return (
    <aside className="session-inspector" data-testid="session-inspector" aria-label="会话检查器">
      <div className="session-inspector-head">
        <div className="session-inspector-title">
          <span>检查器</span>
          <span className="session-inspector-type">{sessionType}</span>
        </div>
        <button
          type="button"
          className="session-inspector-close"
          title="收起右侧栏"
          aria-label="收起右侧栏"
          onClick={onClose}
        >
          <LuPanelRightClose className="size-3.5" />
        </button>
      </div>

      <div className="session-inspector-tabs" role="tablist" aria-label="检查器分区">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tools'}
          className={`session-inspector-tab${tab === 'tools' ? ' is-active' : ''}`}
          onClick={() => setTab('tools')}
        >
          <LuWrench className="size-3.5" />
          工具
        </button>
        {sessionType === 'live' ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'live'}
            className={`session-inspector-tab${tab === 'live' ? ' is-active' : ''}`}
            onClick={() => setTab('live')}
          >
            <LuRadio className="size-3.5" />
            指挥台
          </button>
        ) : null}
      </div>

      <div className="session-inspector-body">
        {error ? <div className="session-inspector-error">{error}</div> : null}

        {tab === 'tools' ? (
          <div className="session-inspector-section">
            <label className="session-inspector-field">
              <span>Agent mode</span>
              <select
                value={mode}
                disabled={busy}
                data-testid="inspector-agent-mode"
                onChange={(event) => {
                  void patchConfig({ agentMode: event.target.value as AgentMode })
                }}
              >
                <option value="standard">standard（全开）</option>
                <option value="minimal">minimal（底座 + 勾选）</option>
              </select>
            </label>

            <div className="session-inspector-sources">
              {sources.map((source) => (
                <div key={source.id} className={`session-inspector-source ${SOURCE_TONE[source.id]}`}>
                  <div className="session-inspector-source-label">{source.label}</div>
                  <div className="session-inspector-source-desc">{source.description}</div>
                </div>
              ))}
            </div>

            <ul className="session-inspector-tools" data-testid="inspector-tools">
              {tools.map((tool) => (
                <li
                  key={tool.name}
                  className={`session-inspector-tool${tool.active ? ' is-active' : ''}`}
                  data-tool={tool.name}
                >
                  <div className="session-inspector-tool-top">
                    {tool.configurable ? (
                      <input
                        type="checkbox"
                        checked={(data?.extraTools ?? []).includes(tool.name)}
                        disabled={busy}
                        aria-label={`启用 ${tool.name}`}
                        onChange={(event) => toggleExtra(tool.name, event.target.checked)}
                      />
                    ) : (
                      <span className="session-inspector-tool-dot" aria-hidden />
                    )}
                    <code>{tool.name}</code>
                    <span className={`session-inspector-badge ${SOURCE_TONE[tool.source]}`}>
                      {tool.source}
                    </span>
                    <span className={`session-inspector-state${tool.active ? ' is-on' : ''}`}>
                      {tool.active ? '可用' : '未开'}
                    </span>
                  </div>
                  <p>{tool.description || '（无说明）'}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="session-inspector-section">
            <p className="session-inspector-hint">其它 chat session 的现场（只读，约 2s 刷新）。</p>
            {workers.length === 0 ? (
              <div className="session-inspector-empty">暂无 worker session</div>
            ) : (
              <ul className="session-inspector-workers" data-testid="inspector-workers">
                {workers.map((worker) => (
                  <li key={worker.id} className="session-inspector-worker">
                    <div className="session-inspector-worker-top">
                      <SidebarMascot
                        size={22}
                        sessionId={worker.id}
                        identity={resolveSessionMascot(worker.id, worker.mascot)}
                        busy={worker.status === 'running'}
                        title={worker.title}
                      />
                      <span className="session-inspector-worker-title">{worker.title}</span>
                      <span
                        className={`session-inspector-state${worker.status === 'running' ? ' is-on' : ''}`}
                      >
                        {worker.status}
                      </span>
                    </div>
                    <div className="session-inspector-worker-meta">
                      {worker.project ? <span>{worker.project}</span> : null}
                      <span>
                        t{worker.turn ?? '—'} / s{worker.step ?? '—'}
                      </span>
                      {worker.lastTool ? <span>{worker.lastTool}</span> : null}
                      {worker.inboxPending > 0 ? <span>inbox {worker.inboxPending}</span> : null}
                    </div>
                    {worker.assistantText ? (
                      <p className="session-inspector-worker-text">{worker.assistantText}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  )
})
