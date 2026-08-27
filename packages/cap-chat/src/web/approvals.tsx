import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuEraser } from 'react-icons/lu'
import type { SlotProps } from '@biu/web-slots'
import { bindSessionView, type ChatNode, type SessionViewService } from '@biu/web-session-view'
import { SessionProjectPanel } from './project-panel.tsx'

type AgentMode = 'standard' | 'minimal'

/** 最新一条回复的历史输入占比（0..1），驱动橡皮擦底色。 */
function latestHistRatio(nodes: ChatNode[]): number | null {
  const last = nodes.at(-1)
  if (!last || last.kind !== 'reply') return null
  const hist = last.usage?.histPct
  if (typeof hist !== 'number' || !Number.isFinite(hist)) return null
  return Math.min(1, Math.max(0, hist))
}

/** Dock 顶栏：左侧文件 + 选取 + 清空上下文 + 标准/极简胶囊，右侧 auto/hold。 */
export function ApprovalsRail(props: SlotProps) {
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const sessionView = props.sessionView as SessionViewService
  const sessionId = useSessionView((state) => state.sessionId)
  const approvals = useSessionView((state) => state.approvals)
  const approvalMode = useSessionView((state) => state.approvalMode)
  const nodes = useSessionView((state) => state.nodes)
  const histRatio = useMemo(() => latestHistRatio(nodes), [nodes])
  const [agentMode, setAgentMode] = useState<AgentMode>('standard')
  const [modeBusy, setModeBusy] = useState(false)
  const [clearBusy, setClearBusy] = useState(false)

  const refreshAgentMode = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/config')
      if (!res.ok) return
      const data = (await res.json()) as { agentMode?: string }
      setAgentMode(data.agentMode === 'minimal' ? 'minimal' : 'standard')
    } catch {
      /* host 未就绪 */
    }
  }, [])

  useEffect(() => {
    void refreshAgentMode()
  }, [refreshAgentMode])

  // 快捷键：command+e / ctrl+e 触发清空上下文（在输入框中同样生效）
  const clearContextRef = useRef<() => void>(() => {})
  useEffect(() => {
    clearContextRef.current = clearContext
  })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isE = event.key === 'e' || event.key === 'E'
      const isMod = event.metaKey || event.ctrlKey
      if (!isE || !isMod || event.shiftKey || event.altKey) return
      event.preventDefault()
      clearContextRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    console.log('[approvals] Command+E shortcut registered')
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      console.log('[approvals] Command+E shortcut unregistered')
    }
  }, [])

  async function setMode(next: AgentMode) {
    if (next === agentMode || modeBusy) return
    setModeBusy(true)
    try {
      const res = await fetch('/api/chat/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentMode: next }),
      })
      if (!res.ok) return
      const data = (await res.json()) as { agentMode?: string }
      setAgentMode(data.agentMode === 'minimal' ? 'minimal' : 'standard')
    } finally {
      setModeBusy(false)
    }
  }

  // 清空上下文：不经过大模型，仅向后端写入一条 context_clear 日志（压缩点）。
  async function clearContext() {
    console.log('[approvals] clearContext triggered, sessionId =', sessionId, ', clearBusy =', clearBusy)
    
    if (!sessionId || clearBusy) return
    setClearBusy(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/clear-context`, { method: 'POST' })
      if (!res.ok) return
      // 后台校对拉取最新事件，使新插入的日志记录立即出现在会话视图中。
      await sessionView.load(sessionId, { view: 'chat', wait: false })
    } finally {
      setClearBusy(false)
    }
  }

  return (
    <div className="w-full space-y-2">
      {approvals.length ? (
        <div className="dock-approval-hint" role="status">
          <div className="dock-approval-hint-label">待确认工具 · 先处理后再发</div>
          {approvals.map((item) => (
            <div key={item.id} className="dock-approval-card">
              <div className="mb-1 font-medium">Approval · {item.name}</div>
              <pre className="mb-2 max-h-20 overflow-auto whitespace-pre-wrap text-[var(--dsw-label-2)]">
                {JSON.stringify(item.args, null, 2)}
              </pre>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full px-3 py-1 text-[11px] text-[var(--dsw-bg)]"
                  style={{ background: 'var(--dsw-business)' }}
                  onClick={() => void sessionView.decideApproval(item.id, true)}
                >
                  Allow
                </button>
                <button
                  type="button"
                  className="rounded-full border border-[var(--dsw-border)] px-3 py-1 text-[11px]"
                  onClick={() => void sessionView.decideApproval(item.id, false)}
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div
        className="flex items-center justify-between gap-2 bg-transparent px-1 text-[11px] text-[var(--dsw-label-3)]"
        role="toolbar"
        aria-label="Session controls"
      >
        <div className="flex min-w-0 items-center gap-2">
          <SessionProjectPanel {...props} />
          {props.renderSlot('header-tools')}
          <button
            type="button"
            disabled={!sessionId || clearBusy}
            aria-label="清空上下文"
            title={
              histRatio != null
                ? `清空上下文 · 历史 ${Math.round(histRatio * 100)}%`
                : '清空上下文'
            }
            className="project-chip project-chip-icon-only relative overflow-hidden"
            onClick={() => void clearContext()}
          >
            {histRatio != null && histRatio > 0 ? (
              <span
                className="pointer-events-none absolute inset-y-0 left-0 bg-[var(--dsw-danger)]/20"
                style={{ width: `${Math.round(histRatio * 100)}%` }}
                aria-hidden
              />
            ) : null}
            <LuEraser size={16} strokeWidth={2} className="relative z-[1]" aria-hidden />
          </button>
          <span className="sr-only">Agent mode</span>
          <div className="dock-seg">
            {([
              ['standard', '标准'],
              ['minimal', '极简'],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                disabled={modeBusy}
                aria-pressed={agentMode === mode}
                className={`px-2.5 py-1 ${
                  agentMode === mode
                    ? 'bg-[var(--dsw-business-soft)] text-[var(--dsw-business)]'
                    : 'hover:bg-[var(--dsw-hover)]'
                }`}
                onClick={() => void setMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="dock-seg">
          <span className="sr-only">Tool approval mode</span>
          {(['auto', 'hold'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`px-2.5 py-1 capitalize ${
                approvalMode === mode
                  ? 'bg-[var(--dsw-business-soft)] text-[var(--dsw-business)]'
                  : 'hover:bg-[var(--dsw-hover)]'
              }`}
              onClick={() => void sessionView.setApprovalMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
