import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import {
  BoltIcon,
  CheckCircleIcon,
  CommandLineIcon,
  ExclamationCircleIcon,
  PaintBrushIcon,
  PauseIcon,
  SparklesIcon,
  Squares2X2Icon,
} from '@heroicons/react/16/solid'
import type { SlotProps } from '@biu/web-slots'
import { bindSessionView, type ChatNode, type DispatchedTaskRow, type SessionViewService } from '@biu/web-session-view'
import { SidebarMascot, resolveSessionMascot } from '@biu/public-mascot'
import { SessionProjectPanel } from './project-panel.tsx'

type AgentMode = 'minimal' | 'standard' | 'create'

function parseAgentMode(value: unknown): AgentMode {
  return value === 'minimal' || value === 'create' ? value : 'standard'
}

/** 最新一条回复里，上下文（更早 turn）占发给模型的输入文字的比例（0..1）。 */
function latestHistRatio(nodes: ChatNode[]): number | null {
  const last = nodes.at(-1)
  if (!last || last.kind !== 'reply') return null
  const hist = last.usage?.histPct
  if (typeof hist !== 'number' || !Number.isFinite(hist)) return null
  return Math.min(1, Math.max(0, hist))
}

function DockIconMenu<T extends string>({
  label,
  value,
  options,
  disabled,
  align = 'start',
  open,
  wrapRef,
  onOpenChange,
  onSelect,
}: {
  label: string
  value: T
  options: { id: T; label: string; icon: ReactNode; hint?: string }[]
  disabled?: boolean
  align?: 'start' | 'end'
  open: boolean
  wrapRef: RefObject<HTMLDivElement | null>
  onOpenChange: (open: boolean) => void
  onSelect: (id: T) => void
}) {
  const current = options.find((item) => item.id === value) ?? options[0]!
  return (
    <div className={`dock-icon-wrap${align === 'end' ? ' is-end' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className={`dock-icon-btn${open ? ' is-active' : ''}`}
        aria-label={`${label}：${current.label}`}
        data-dock-tip={`${label}：${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        {current.icon}
      </button>
      {open ? (
        <div className="dock-icon-menu" role="menu">
          <div className="dock-icon-head">{label}</div>
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`dock-icon-item${opt.id === value ? ' is-active' : ''}`}
              role="menuitemradio"
              aria-checked={opt.id === value}
              onClick={() => {
                onSelect(opt.id)
                onOpenChange(false)
              }}
            >
              <span className="dock-icon-item-label">
                <span className="dock-icon-item-ico">{opt.icon}</span>
                {opt.label}
              </span>
              <span className="dock-icon-item-end">
                {opt.id === value ? <CheckCircleIcon aria-hidden className="size-3.25 dock-icon-check" /> : null}
                {opt.hint ? (
                  <span
                    className="dock-icon-hint"
                    data-dock-tip={opt.hint}
                    aria-label={opt.hint}
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <ExclamationCircleIcon className="size-3.5" aria-hidden />
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function dockAgentLabel(title?: string, fallback = 'Agent') {
  const line = (title ?? '')
    .split('\n')
    .map((part) => part.trim())
    .find(Boolean)
  const raw = line || fallback
  return raw.length > 36 ? `${raw.slice(0, 35)}…` : raw
}
const DOCK_WORKER_CAP = 3

function workerRecency(row: DispatchedTaskRow) {
  return row.wakeTs ?? (row.liveTurn ?? 0) * 1_000_000_000
}

function activeWorkerAgents(
  byTurn: Record<string, DispatchedTaskRow[]>,
  sessionId: string | null,
): DispatchedTaskRow[] {
  const latest = new Map<string, DispatchedTaskRow>()
  for (const rows of Object.values(byTurn)) {
    for (const row of rows) {
      if (row.status !== 'running' && row.status !== 'pending') continue
      if (!row.sessionId || row.sessionId === sessionId) continue
      const prev = latest.get(row.sessionId)
      if (!prev || workerRecency(row) >= workerRecency(prev)) latest.set(row.sessionId, row)
    }
  }
  return [...latest.values()].sort((a, b) => workerRecency(b) - workerRecency(a))
}
export function ApprovalsRail(props: SlotProps) {
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const sessionView = props.sessionView as SessionViewService
  const sessionId = useSessionView((state) => state.sessionId)
  const sessions = useSessionView((state) => state.sessions)
  const dispatchedTasksByTurn = useSessionView((state) => state.dispatchedTasksByTurn)
  const workerAgents = useMemo(
    () => activeWorkerAgents(dispatchedTasksByTurn, sessionId),
    [dispatchedTasksByTurn, sessionId],
  )
  const visibleWorkers = workerAgents.slice(0, DOCK_WORKER_CAP)
  const hiddenWorkerCount = Math.max(0, workerAgents.length - visibleWorkers.length)
  const approvals = useSessionView((state) => state.approvals)
  const approvalMode = useSessionView((state) => state.approvalMode)
  const nodes = useSessionView((state) => state.nodes)
  const histRatio = useMemo(() => latestHistRatio(nodes), [nodes])
  const [agentMode, setAgentMode] = useState<AgentMode>('standard')
  const [modeBusy, setModeBusy] = useState(false)
  const [clearBusy, setClearBusy] = useState(false)
  const [agentMenuOpen, setAgentMenuOpen] = useState(false)
  const [approvalMenuOpen, setApprovalMenuOpen] = useState(false)
  const agentMenuRef = useRef<HTMLDivElement>(null)
  const approvalMenuRef = useRef<HTMLDivElement>(null)

  const refreshAgentMode = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/config')
      if (!res.ok) return
      const data = (await res.json()) as { agentMode?: string }
      setAgentMode(parseAgentMode(data.agentMode))
    } catch {
      /* host 未就绪 */
    }
  }, [])

  useEffect(() => {
    void refreshAgentMode()
  }, [refreshAgentMode])

  useEffect(() => {
    if (!agentMenuOpen && !approvalMenuOpen) return
    const onDown = (event: MouseEvent) => {
      const node = event.target as Node
      if (agentMenuRef.current?.contains(node) || approvalMenuRef.current?.contains(node)) {
        return
      }
      setAgentMenuOpen(false)
      setApprovalMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setAgentMenuOpen(false)
      setApprovalMenuOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [agentMenuOpen, approvalMenuOpen])

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
      setAgentMode(parseAgentMode(data.agentMode))
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
              <pre className="mb-2 max-h-20 overflow-auto whitespace-pre-wrap text-(--dsw-label-2)">
                {JSON.stringify(item.args, null, 2)}
              </pre>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full px-3 py-1 text-(length:--dsw-chat-ui-font-size) text-(--dsw-bg)"
                  style={{ background: 'var(--dsw-business)' }}
                  onClick={() => void sessionView.decideApproval(item.id, true)}
                >
                  Allow
                </button>
                <button
                  type="button"
                  className="rounded-full border border-(--dsw-border) px-3 py-1 text-(length:--dsw-chat-ui-font-size)"
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
        className="chat-dock-toolbar bg-transparent px-1 text-(length:--dsw-chat-ui-font-size) text-(--dsw-label-3)"
        role="toolbar"
        aria-label="Session controls"
      >
        <div className="chat-dock-toolbar-start flex min-w-0 items-center gap-1">
          <button
            type="button"
            disabled={!sessionId || clearBusy}
            aria-label="清空上下文"
            className="project-chip project-chip-icon-only project-chip-clear-ctx relative"
            data-dock-tip={
              histRatio != null
                ? `清空上下文 · 上下文占输入文字 ${Math.round(histRatio * 100)}%`
                : '清空上下文'
            }
            onClick={() => void clearContext()}
          >
            {histRatio != null && histRatio > 0 ? (
              <span className="project-chip-hist" aria-hidden>
                <span className="project-chip-hist-bar" style={{ height: `${Math.round(histRatio * 100)}%` }} />
              </span>
            ) : null}
            <PaintBrushIcon className="size-4 relative z-1" aria-hidden />
          </button>
          {typeof props.renderSlot === 'function' ? props.renderSlot('header-tools') : null}
            {visibleWorkers.length ? (
            <span className="dock-agent-stack" data-testid="dock-agent-stack">
              {visibleWorkers.map((worker, index) => {
                const identity = resolveSessionMascot(worker.sessionId, worker.mascot)
                const listed = sessions.find((item) => item.id === worker.sessionId)
                const name = dockAgentLabel(listed?.title ?? worker.title ?? worker.preview, identity.shape)
                return (
                  <span
                    key={worker.sessionId}
                    className="dock-worker-mascot"
                    data-testid="dock-worker-mascot"
                    data-dock-tip={name}
                    style={{ zIndex: 6 - index }}
                  >
                    <SidebarMascot
                      size={28}
                      sessionId={worker.sessionId}
                      identity={identity}
                      busy={worker.status === 'running'}
                      animate={false}
                      title={name}
                    />
                  </span>
                )
              })}
              {hiddenWorkerCount > 0 ? (
                <span
                  className="dock-worker-more"
                  data-testid="dock-worker-more"
                  title={`还有 ${hiddenWorkerCount} 个 Agent 在干活`}
                >
                  +{hiddenWorkerCount}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
        <div className="chat-dock-toolbar-end flex shrink-0 items-center justify-end gap-1">
          <SessionProjectPanel {...props} />
          <DockIconMenu
            label="Agent 模式"
            value={agentMode}
            disabled={modeBusy}
            align="end"
            open={agentMenuOpen}
            wrapRef={agentMenuRef}
            onOpenChange={(next) => {
              setAgentMenuOpen(next)
              if (next) setApprovalMenuOpen(false)
            }}
            onSelect={(mode) => void setMode(mode)}
            options={[
              {
                id: 'minimal',
                label: '极简',
                icon: <CommandLineIcon className="size-4" aria-hidden />,
                hint: '只开放 bash 和文件编辑。上下文更省，适合改一小段、少打扰。',
              },
              {
                id: 'standard',
                label: '标准',
                icon: <Squares2X2Icon className="size-4" aria-hidden />,
                hint: '内置 Agent 工具全开（读文件、任务、MCP 等），不含商店插件。',
              },
              {
                id: 'create',
                label: '创造',
                icon: <SparklesIcon className="size-4" aria-hidden />,
                hint: '在标准之上，允许调用已安装的商店插件工具。',
              },
            ]}
          />
          <DockIconMenu
            label="工具审批"
            value={approvalMode === 'hold' ? 'hold' : 'auto'}
            align="end"
            open={approvalMenuOpen}
            wrapRef={approvalMenuRef}
            onOpenChange={(next) => {
              setApprovalMenuOpen(next)
              if (next) setAgentMenuOpen(false)
            }}
            onSelect={(mode) => void sessionView.setApprovalMode(mode)}
            options={[
              {
                id: 'auto',
                label: 'Auto',
                icon: <BoltIcon className="size-4" aria-hidden />,
                hint: '工具直接执行，不弹出确认。适合你信任当前会话、想少打断的时候。',
              },
              {
                id: 'hold',
                label: 'Hold',
                icon: <PauseIcon className="size-4" aria-hidden />,
                hint: '敏感工具先停住等你点允许或拒绝，超时未处理则拒绝。',
              },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
