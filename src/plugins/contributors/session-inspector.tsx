import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LuListChecks, LuListTree, LuPanelRightClose, LuSettings2, LuWrench } from 'react-icons/lu'
import {
  bindSessionView,
  type SessionViewService,
} from '../infrastructure/session-view.ts'
import { TrajectoryView } from './chat/trajectory.tsx'

type ToolSourceId = 'minimal' | 'live' | 'plugin'
type AgentMode = 'standard' | 'minimal'
type ChatProvider = 'deepseek' | 'openai'
type InspectorTab = 'config' | 'traj' | 'tasks'

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

interface SessionConfigFields {
  title?: string
  provider?: ChatProvider
  model?: string
  systemPrompt?: string
  agentMode?: AgentMode
  extraTools?: string[]
}

interface InspectorPayload {
  sessionId: string
  type: 'chat' | 'live'
  title?: string | null
  agentMode: AgentMode
  extraTools: string[]
  defaults?: SessionConfigFields & { agentMode: AgentMode; extraTools: string[]; provider: ChatProvider; model: string; systemPrompt: string }
  config?: SessionConfigFields | null
  effective?: SessionConfigFields & { agentMode: AgentMode; extraTools: string[]; provider: ChatProvider; model: string; systemPrompt: string }
  sources: InspectorSource[]
  tools: InspectorTool[]
}

export type SessionInspectorProps = {
  open: boolean
  width: number
  onWidthChange: (width: number) => void
  onClose: () => void
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView: SessionViewService
  renderSlot?: (name: string) => ReactNode
}

const tabClass = (active: boolean) =>
  `inline-flex cursor-pointer items-center gap-1.5 rounded-[6px] border-0 px-2 py-1.5 text-[11px] font-semibold ${
    active
      ? 'bg-[color-mix(in_srgb,var(--dsw-business)_14%,transparent)] text-[var(--dsw-business)]'
      : 'bg-transparent text-[var(--dsw-label-3)] hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-label)]'
  }`

const fieldClass =
  'rounded-[8px] border border-[var(--dsw-border)] bg-[var(--dsw-surface)] px-2 py-1.5 text-[12px] text-[var(--dsw-label)] outline-none'

export const SessionInspector = memo(function SessionInspector({
  open,
  width,
  onWidthChange,
  onClose,
  useSessionView,
  sessionView,
  renderSlot,
}: SessionInspectorProps) {
  const sessionId = useSessionView((state) => state.sessionId)
  const focusCallId = useSessionView((state) => state.focusCallId)

  const [tab, setTab] = useState<InspectorTab>('config')
  const [data, setData] = useState<InspectorPayload | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [promptDraft, setPromptDraft] = useState('')
  const titleFocusedRef = useRef(false)
  const promptFocusedRef = useRef(false)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    if (focusCallId) {
      setTab('traj')
      return
    }
    setTab('config')
  }, [sessionId, focusCallId])

  useEffect(() => {
    if (!open || tab !== 'traj') return
    void sessionView.ensureTrajectory()
  }, [open, tab, sessionId, sessionView])

  const refresh = useCallback(async () => {
    if (!sessionId || !open) return
    try {
      const res = await fetch(`/api/sessions/${sessionId}/inspector`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as InspectorPayload
      setData(body)
      // 编辑中勿被轮询覆盖，否则 blur 会把半成品写回或看起来像「改不了」
      if (!titleFocusedRef.current) setTitleDraft(body.config?.title ?? '')
      if (!promptFocusedRef.current) {
        setPromptDraft(
          typeof body.config?.systemPrompt === 'string'
            ? body.config.systemPrompt
            : (body.defaults?.systemPrompt ?? ''),
        )
      }
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

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const next = drag.startWidth + (drag.startX - event.clientX)
      onWidthChange(next)
    }
    const onUp = () => {
      dragRef.current = null
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [onWidthChange])

  async function patchSessionConfig(patch: Record<string, unknown>) {
    if (!sessionId) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/sessions/${sessionId}/config`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(`保存失败 HTTP ${res.status}`)
      await refresh()
      void sessionView.refreshSessions()
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  function toggleExtra(name: string, checked: boolean) {
    const current = data?.effective?.extraTools ?? data?.extraTools ?? []
    const next = checked
      ? [...new Set([...current, name])]
      : current.filter((item) => item !== name)
    void patchSessionConfig({ extraTools: next, agentMode: 'minimal' })
  }

  if (!open) return null

  const defaults = data?.defaults
  const effective = data?.effective
  const mode = effective?.agentMode ?? data?.agentMode ?? 'standard'
  const sources = data?.sources ?? []
  const tools = data?.tools ?? []

  return (
    <aside
      className="relative flex min-h-0 min-w-0 flex-col border-l border-[var(--dsw-border)] bg-[var(--dsw-sidebar)] text-[var(--dsw-label)]"
      data-testid="session-inspector"
      aria-label="会话检查器"
    >
      <div
        className="absolute inset-y-0 left-0 z-10 w-1 cursor-col-resize touch-none"
        data-testid="inspector-resize"
        title="拖动调整宽度"
        onPointerDown={(event) => {
          event.preventDefault()
          dragRef.current = { startX: event.clientX, startWidth: width }
          document.body.style.cursor = 'col-resize'
          document.body.style.userSelect = 'none'
        }}
      />

      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-[var(--dsw-border)] px-2.5">
        <div className="flex min-w-0 items-center gap-1" role="tablist" aria-label="检查器分区">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'config'}
            className={tabClass(tab === 'config')}
            onClick={() => setTab('config')}
            data-testid="inspector-tab-config"
          >
            <LuSettings2 className="size-3.5" />
            配置
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'traj'}
            className={tabClass(tab === 'traj')}
            onClick={() => setTab('traj')}
            data-testid="inspector-tab-traj"
          >
            <LuListTree className="size-3.5" />
            轨迹
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'tasks'}
            className={tabClass(tab === 'tasks')}
            onClick={() => setTab('tasks')}
            data-testid="inspector-tab-tasks"
          >
            <LuListChecks className="size-3.5" />
            任务
          </button>
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

      <div
        className={`min-h-0 flex-1 ${
          tab === 'traj' || tab === 'tasks' ? 'flex flex-col overflow-hidden' : 'overflow-auto p-2.5'
        }`}
      >
        {error && tab === 'config' ? (
          <div className="mb-2 rounded-[8px] bg-[color-mix(in_srgb,#c44_16%,transparent)] p-2 text-[11px] text-[#f08888]">
            {error}
          </div>
        ) : null}

        {tab === 'config' ? (
          <div className="flex flex-col gap-2.5">
            {!sessionId ? (
              <div className="text-[11px] leading-[1.45] text-[var(--dsw-label-3)]">打开会话后可编辑配置。</div>
            ) : (
              <>
                <p className="m-0 text-[11px] leading-[1.45] text-[var(--dsw-label-3)]">
                  未填写的字段使用全局默认（Settings）。此处只覆盖当前 session。
                </p>

                <label className="flex flex-col gap-1 text-[11px] text-[var(--dsw-label-3)]">
                  <span>名称</span>
                  <input
                    className={fieldClass}
                    value={titleDraft}
                    placeholder={defaults?.title || '未命名（用最近消息推导）'}
                    disabled={busy}
                    data-testid="inspector-session-title"
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onFocus={() => {
                      titleFocusedRef.current = true
                    }}
                    onBlur={() => {
                      titleFocusedRef.current = false
                      const next = titleDraft.trim()
                      const prev = data?.config?.title ?? ''
                      if (next === prev) return
                      void patchSessionConfig({ title: next || null })
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      ;(event.target as HTMLInputElement).blur()
                    }}
                  />
                </label>

                <label className="flex flex-col gap-1 text-[11px] text-[var(--dsw-label-3)]">
                  <span>Provider · 默认 {defaults?.provider ?? '—'}</span>
                  <select
                    className={fieldClass}
                    value={effective?.provider ?? defaults?.provider ?? 'deepseek'}
                    disabled={busy}
                    onChange={(event) =>
                      void patchSessionConfig({ provider: event.target.value as ChatProvider })
                    }
                  >
                    <option value="deepseek">deepseek</option>
                    <option value="openai">openai</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-[11px] text-[var(--dsw-label-3)]">
                  <span>Model · 默认 {defaults?.model ?? '—'}</span>
                  <input
                    className={fieldClass}
                    defaultValue={effective?.model ?? ''}
                    key={`${sessionId}-${effective?.model ?? ''}`}
                    placeholder={defaults?.model ?? ''}
                    disabled={busy}
                    onBlur={(event) => {
                      const next = event.target.value.trim()
                      if (next === (data?.config?.model ?? defaults?.model ?? '')) return
                      void patchSessionConfig({ model: next || defaults?.model || '' })
                    }}
                  />
                </label>

                <label className="flex flex-col gap-1 text-[11px] text-[var(--dsw-label-3)]">
                  <span>Agent mode</span>
                  <select
                    className={fieldClass}
                    value={mode}
                    disabled={busy}
                    data-testid="inspector-agent-mode"
                    onChange={(event) =>
                      void patchSessionConfig({ agentMode: event.target.value as AgentMode })
                    }
                  >
                    <option value="standard">standard（全开）</option>
                    <option value="minimal">minimal（底座 + 勾选）</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-[11px] text-[var(--dsw-label-3)]">
                  <span>系统提示词</span>
                  <textarea
                    className={`${fieldClass} min-h-[88px] resize-y font-mono text-[11px] leading-[1.45]`}
                    value={promptDraft}
                    disabled={busy}
                    data-testid="inspector-system-prompt"
                    onChange={(event) => setPromptDraft(event.target.value)}
                    onFocus={() => {
                      promptFocusedRef.current = true
                    }}
                    onBlur={() => {
                      promptFocusedRef.current = false
                      const prev =
                        typeof data?.config?.systemPrompt === 'string'
                          ? data.config.systemPrompt
                          : (defaults?.systemPrompt ?? '')
                      if (promptDraft === prev) return
                      void patchSessionConfig({ systemPrompt: promptDraft })
                    }}
                  />
                </label>

                <div className="flex flex-col gap-px">
                  {sources.map((source) => (
                    <div key={source.id} className="rounded-[8px] px-2 py-1.5 hover:bg-[var(--dsw-hover)]">
                      <div className="text-[11px] font-semibold text-[var(--dsw-label-2)]">{source.label}</div>
                      <div className="mt-0.5 text-[11px] leading-[1.4] text-[var(--dsw-label-3)]">
                        {source.description}
                      </div>
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
                          checked={(effective?.extraTools ?? data?.extraTools ?? []).includes(tool.name)}
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
              </>
            )}
          </div>
        ) : null}

        {tab === 'traj' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="inspector-trajectory">
            <TrajectoryView useSessionView={useSessionView} sessionView={sessionView} />
          </div>
        ) : null}

        {tab === 'tasks' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="inspector-tasks">
            {renderSlot?.('inspector-tasks') ?? (
              <div className="p-3 text-[11px] leading-[1.45] text-[var(--dsw-label-3)]">
                任务插件未启用。在 cordis.plugins.json 打开 @hmr/tasks-* 后刷新。
              </div>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  )
})
