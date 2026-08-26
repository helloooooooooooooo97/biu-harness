import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { LuWrench } from 'react-icons/lu'
import {
  bindSessionView,
  type SessionViewService,
} from './index.ts'

type ToolSourceId = 'minimal' | 'live' | 'plugin'
type AgentMode = 'standard' | 'minimal'
type ChatProvider = 'deepseek' | 'openai'

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

const fieldClass =
  'rounded-[8px] border border-[var(--dsw-border)] bg-[var(--dsw-surface)] px-2 py-1.5 text-[12px] text-[var(--dsw-label)] outline-none'

export type SessionConfigDialogProps = {
  open: boolean
  onClose: () => void
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView: SessionViewService
}

export const SessionConfigDialog = memo(function SessionConfigDialog({
  open,
  onClose,
  useSessionView,
  sessionView,
}: SessionConfigDialogProps) {
  const sessionId = useSessionView((state) => state.sessionId)
  const [data, setData] = useState<InspectorPayload | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [promptDraft, setPromptDraft] = useState('')
  const titleFocusedRef = useRef(false)
  const promptFocusedRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!sessionId || !open) return
    try {
      const res = await fetch(`/api/sessions/${sessionId}/inspector`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as InspectorPayload
      setData(body)
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

  // 打开时刷新一次，并在打开期间轮询保持同步
  useEffect(() => {
    if (!open) return
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, 2000)
    return () => window.clearInterval(timer)
  }, [open, sessionId, refresh])

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
  const sources = data?.sources ?? []
  const tools = data?.tools ?? []

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-[var(--dsw-overlay)]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="会话配置"
    >
      <div
        className="flex max-h-[min(720px,calc(100vh-48px))] w-[min(560px,calc(100vw-48px))] flex-col overflow-hidden rounded-[24px] bg-[var(--dsw-surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--dsw-border)] px-5 py-3">
          <h2 className="text-sm font-medium text-[var(--dsw-label)]">配置</h2>
          <button
            type="button"
            className="rounded-full px-2 py-1 text-sm text-[var(--dsw-label-3)] hover:bg-[var(--dsw-hover)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error ? (
            <div className="mb-2 rounded-[8px] bg-[color-mix(in_srgb,#c44_16%,transparent)] p-2 text-[11px] text-[#f08888]">
              {error}
            </div>
          ) : null}
          {!sessionId ? (
            <div className="text-[11px] leading-[1.45] text-[var(--dsw-label-3)]">打开会话后可编辑配置。</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <p className="m-0 text-[11px] leading-[1.45] text-[var(--dsw-label-3)]">
                名称、提示词和工具只作用于当前 session；未改的字段沿用全局默认。
              </p>

              <label className="flex flex-col gap-1 text-[11px] text-[var(--dsw-label-3)]">
                <span>名称</span>
                <input
                  className={fieldClass}
                  value={titleDraft}
                  placeholder={defaults?.title || '未命名（用最近消息推导）'}
                  disabled={busy}
                  data-testid="config-session-title"
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
                <span>系统提示词</span>
                <textarea
                  className={`${fieldClass} min-h-[88px] resize-y font-mono text-[11px] leading-[1.45]`}
                  value={promptDraft}
                  disabled={busy}
                  data-testid="config-system-prompt"
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

              <ul className="m-0 flex list-none flex-col gap-px p-0" data-testid="config-tools">
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
