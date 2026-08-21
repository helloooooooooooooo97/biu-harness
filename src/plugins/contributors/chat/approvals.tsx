import { useCallback, useEffect, useState } from 'react'
import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'
import { SessionProjectPanel } from './project-panel.tsx'

type AgentMode = 'standard' | 'minimal'

/** Dock 顶栏：Bind project + 极简/标准胶囊；pending approval 在 auto/hold 上方提示。 */
export function ApprovalsRail(props: SlotProps) {
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const sessionView = props.sessionView as SessionViewService
  const approvals = useSessionView((state) => state.approvals)
  const approvalMode = useSessionView((state) => state.approvalMode)
  const [agentMode, setAgentMode] = useState<AgentMode>('standard')
  const [modeBusy, setModeBusy] = useState(false)

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

  return (
    <div className="w-full space-y-2">
      <div className="dock-capsules" role="toolbar" aria-label="Session controls">
        <SessionProjectPanel {...props} />
        <div className="dock-mode-pills" role="group" aria-label="Agent mode">
          <button
            type="button"
            className={`dock-mode-pill${agentMode === 'standard' ? ' is-active' : ''}`}
            disabled={modeBusy}
            aria-pressed={agentMode === 'standard'}
            onClick={() => void setMode('standard')}
          >
            标准模式
          </button>
          <button
            type="button"
            className={`dock-mode-pill${agentMode === 'minimal' ? ' is-active' : ''}`}
            disabled={modeBusy}
            aria-pressed={agentMode === 'minimal'}
            onClick={() => void setMode('minimal')}
          >
            极简模式
          </button>
        </div>
      </div>

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
                  className="rounded-full px-3 py-1 text-[11px] text-white"
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

      <div className="flex items-center justify-end gap-2 px-1 text-[11px] text-[var(--dsw-label-3)]">
        <span className="sr-only">Tool approval mode</span>
        <div className="flex overflow-hidden rounded-full border border-[var(--dsw-border)] bg-white">
          {(['auto', 'hold'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`px-2.5 py-1 capitalize ${
                approvalMode === mode
                  ? 'bg-[var(--dsw-business-soft)] text-[var(--dsw-business)]'
                  : 'hover:bg-black/[0.03]'
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
