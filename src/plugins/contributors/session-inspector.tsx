import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LuActivity, LuListChecks, LuListTree, LuPanelRightClose } from 'react-icons/lu'
import {
  bindSessionView,
  type SessionViewService,
} from '../infrastructure/session-view.ts'
import { TrajectoryView } from './chat/trajectory.tsx'
import { UsagePanel } from './chat/usage-panel.tsx'

type InspectorTab = 'tasks' | 'traj' | 'usage'

export type SessionInspectorProps = {
  open: boolean
  width: number
  onWidthChange: (width: number) => void
  onClose: () => void
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView: SessionViewService
  renderSlot?: (name: string) => ReactNode
}

const TABS: InspectorTab[] = ['tasks', 'traj', 'usage']

function inspectorStoredTab(sid: string | null | undefined): InspectorTab | undefined {
  if (!sid) return undefined
  try {
    const raw = localStorage.getItem(`inspector.tab:${sid}`)
    if (raw && (TABS as string[]).includes(raw)) return raw as InspectorTab
  } catch {
    /* ignore */
  }
  return undefined
}

const tabClass = (active: boolean) =>
  `inline-flex cursor-pointer items-center gap-1.5 rounded-[6px] border-0 px-2 py-1.5 text-[11px] font-semibold ${
    active
      ? 'bg-[color-mix(in_srgb,var(--dsw-business)_14%,transparent)] text-[var(--dsw-business)]'
      : 'bg-transparent text-[var(--dsw-label-3)] hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-label)]'
  }`

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

  const [tab, setTabState] = useState<InspectorTab>(() => inspectorStoredTab(sessionId) ?? 'tasks')
  const setTab = useCallback(
    (next: InspectorTab) => {
      setTabState(next)
      if (!sessionId) return
      try {
        localStorage.setItem(`inspector.tab:${sessionId}`, next)
      } catch {
        /* ignore */
      }
    },
    [sessionId],
  )
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    if (focusCallId) {
      setTab('traj')
      return
    }
    // 会话变化：优先恢复该会话已存的 tab；无则默认 tasks
    setTabState(inspectorStoredTab(sessionId) ?? 'tasks')
  }, [sessionId, focusCallId])

  useEffect(() => {
    if (!open || tab !== 'traj') return
    void sessionView.ensureTrajectory()
  }, [open, tab, sessionId, sessionView])

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

  if (!open) return null

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
            aria-selected={tab === 'tasks'}
            className={tabClass(tab === 'tasks')}
            onClick={() => setTab('tasks')}
            data-testid="inspector-tab-tasks"
          >
            <LuListChecks className="size-3.5" />
            任务
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
            aria-selected={tab === 'usage'}
            className={tabClass(tab === 'usage')}
            onClick={() => setTab('usage')}
            data-testid="inspector-tab-usage"
          >
            <LuActivity className="size-3.5" />
            用量
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

        {tab === 'usage' ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-2.5" data-testid="inspector-usage">
            <UsagePanel useSessionView={useSessionView} sessionView={sessionView} />
          </div>
        ) : null}
      </div>
    </aside>
  )
})
