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

export type SessionInspectorProps = {
  open: boolean
  onClose: () => void
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView: SessionViewService
}

const tabClass = (active: boolean) =>
  `inline-flex cursor-pointer items-center gap-1.5 rounded-[6px] border-0 px-2 py-1.5 text-[11px] font-semibold ${
    active
      ? 'bg-[color-mix(in_srgb,var(--dsw-business)_14%,transparent)] text-[var(--dsw-business)]'
      : 'bg-transparent text-[var(--dsw-label-3)] hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-label)]'
  }`

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

  const mode = data?.agentMode ?? 'standard'
  const sources = data?.sources ?? []
  const tools = data?.tools ?? []
  const workers = data?.workers ?? []

  return (
    <aside
      className="flex min-h-0 min-w-0 flex-col border-l border-[var(--dsw-border)] bg-[var(--dsw-sidebar)] text-[var(--dsw-label)]"
      data-testid="session-inspector"
      aria-label="会话检查器"
    >
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-[var(--dsw-border)] px-2.5">
        <div className="flex min-w-0 items-center gap-2 text-[12px] font-semibold">
          <span>检查器</span>
          <span className="rounded-full bg-[var(--dsw-muted-fill)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--dsw-label-3)] uppercase">
            {sessionType}
          </span>
        </div>
        <button
          type="button"
          className="grid size-6 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent text-[var(--dsw-label-3)] hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-business)]"
          title="收起右侧栏"
          aria-label="收起右侧栏"
          onClick={onClose}
        >
          <LuPanelRightClose className="size-3.5" />
        </button>
      </div>

      <div className="flex shrink-0 gap-1 border-b border-[var(--dsw-border)] px-2 py-1.5" role="tablist" aria-label="检查器分区">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tools'}
          className={tabClass(tab === 'tools')}
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
            className={tabClass(tab === 'live')}
            onClick={() => setTab('live')}
          >
            <LuRadio className="size-3.5" />
            指挥台
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2.5">
        {error ? (
          <div className="mb-2 rounded-[8px] bg-[color-mix(in_srgb,#c44_16%,transparent)] p-2 text-[11px] text-[#f08888]">
            {error}
          </div>
        ) : null}

        {tab === 'tools' ? (
          <div className="flex flex-col gap-2.5">
            <label className="flex flex-col gap-1 text-[11px] text-[var(--dsw-label-3)]">
              <span>Agent mode</span>
              <select
                className="rounded-[8px] border border-[var(--dsw-border)] bg-[var(--dsw-surface)] px-2 py-1.5 text-[12px] text-[var(--dsw-label)]"
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

            <div className="flex flex-col gap-px">
              {sources.map((source) => (
                <div key={source.id} className="rounded-[8px] px-2 py-1.5 hover:bg-[var(--dsw-hover)]">
                  <div className="text-[11px] font-semibold text-[var(--dsw-label-2)]">{source.label}</div>
                  <div className="mt-0.5 text-[11px] leading-[1.4] text-[var(--dsw-label-3)]">{source.description}</div>
                </div>
              ))}
            </div>

            <ul className="m-0 flex list-none flex-col gap-px p-0" data-testid="inspector-tools">
              {tools.map((tool) => (
                <li
                  key={tool.name}
                  className={`relative box-border flex h-[30px] min-h-[30px] w-full items-center gap-2 rounded-[8px] border-0 px-2 py-[5px] text-[12px] font-medium leading-[1.2] transition-none hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-label)] ${
                    tool.active ? 'text-[var(--dsw-label)]' : 'text-[var(--dsw-label-2)]'
                  }`}
                  data-tool={tool.name}
                  title={tool.description || tool.name}
                >
                  {tool.configurable ? (
                    <input
                      type="checkbox"
                      className="m-0 size-3.5 shrink-0 accent-[var(--dsw-business)]"
                      checked={(data?.extraTools ?? []).includes(tool.name)}
                      disabled={busy}
                      aria-label={`启用 ${tool.name}`}
                      onChange={(event) => toggleExtra(tool.name, event.target.checked)}
                    />
                  ) : (
                    <span
                      className={`grid size-4 shrink-0 place-items-center ${
                        tool.active ? 'text-[var(--dsw-label)]' : 'text-[var(--dsw-label-3)]'
                      }`}
                      aria-hidden
                    >
                      <LuWrench className="size-3.5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium">{tool.name}</span>
                  <span className="shrink-0 text-[10px] font-medium lowercase text-[var(--dsw-label-3)]">
                    {tool.source}
                  </span>
                  <span
                    className={`ml-auto shrink-0 text-[10px] font-semibold ${
                      tool.active ? 'text-[var(--dsw-ok,#34d399)]' : 'text-[var(--dsw-label-3)]'
                    }`}
                  >
                    {tool.active ? '可用' : '未开'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <p className="m-0 text-[11px] leading-[1.45] text-[var(--dsw-label-3)]">
              其它 chat session 的现场（只读，约 2s 刷新）。
            </p>
            {workers.length === 0 ? (
              <div className="text-[11px] leading-[1.45] text-[var(--dsw-label-3)]">暂无 worker session</div>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-px p-0" data-testid="inspector-workers">
                {workers.map((worker) => (
                  <li key={worker.id} className="rounded-[8px] px-2 py-1.5 hover:bg-[var(--dsw-hover)]">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <SidebarMascot
                        size={22}
                        sessionId={worker.id}
                        identity={resolveSessionMascot(worker.id, worker.mascot)}
                        busy={worker.status === 'running'}
                        animate={false}
                        title={worker.title}
                      />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{worker.title}</span>
                      <span
                        className={`ml-auto shrink-0 text-[10px] font-semibold ${
                          worker.status === 'running'
                            ? 'text-[var(--dsw-ok,#34d399)]'
                            : 'text-[var(--dsw-label-3)]'
                        }`}
                      >
                        {worker.status}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-[var(--dsw-label-3)]">
                      {worker.project ? <span>{worker.project}</span> : null}
                      <span>
                        t{worker.turn ?? '—'} / s{worker.step ?? '—'}
                      </span>
                      {worker.lastTool ? <span>{worker.lastTool}</span> : null}
                      {worker.inboxPending > 0 ? <span>inbox {worker.inboxPending}</span> : null}
                    </div>
                    {worker.assistantText ? (
                      <p className="mt-1.5 mb-0 text-[11px] leading-[1.45] text-[var(--dsw-label-3)]">
                        {worker.assistantText}
                      </p>
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
