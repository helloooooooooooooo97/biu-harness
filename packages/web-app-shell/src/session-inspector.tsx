import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { LuActivity, LuLayoutGrid, LuListTree, LuPanelRightClose } from 'react-icons/lu'
import {
  bindSessionView,
  type SessionViewService,
} from '@biu/web-session-view'
import { TrajectoryView } from '@biu/cap-chat/trajectory'
import { UsagePanel } from '@biu/cap-chat/usage-panel'
import { useSlotEntries } from '@biu/web-slots'
import type { SlotsService } from '@biu/web-slots'

const BUILTIN_TABS = ['traj', 'usage'] as const

export type SessionInspectorProps = {
  open: boolean
  width: number
  onWidthChange: (width: number) => void
  onClose: () => void
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView: SessionViewService
  slots: SlotsService
  renderSlot: (name: string) => ReactNode
}

function inspectorStoredTab(sid: string | null | undefined, allowed: string[]): string | undefined {
  if (!sid) return undefined
  try {
    const raw = localStorage.getItem(`inspector.tab:${sid}`)
    if (raw && allowed.includes(raw)) return raw
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
  slots,
  renderSlot,
}: SessionInspectorProps) {
  const sessionId = useSessionView((state) => state.sessionId)
  const focusCallId = useSessionView((state) => state.focusCallId)
  const extras = useSlotEntries(slots, 'inspector-panels')
  const extraTabs = useMemo(
    () =>
      [...extras]
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .map((entry) => {
          const extra = entry.props?.() ?? {}
          return {
            entry,
            id: String(extra.tabId ?? entry.id),
            label: String(extra.tabLabel ?? '插件'),
            Icon: extra.tabIcon as ComponentType<{ className?: string }> | undefined,
          }
        }),
    [extras],
  )
  const allowedTabs = useMemo(() => [...extraTabs.map((item) => item.id), ...BUILTIN_TABS], [extraTabs])

  const [tab, setTabState] = useState(() => inspectorStoredTab(sessionId, allowedTabs) ?? extraTabs[0]?.id ?? 'traj')
  const setTab = useCallback(
    (next: string) => {
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
    setTabState(inspectorStoredTab(sessionId, allowedTabs) ?? extraTabs[0]?.id ?? 'traj')
  }, [sessionId, focusCallId, allowedTabs.join('|'), extraTabs[0]?.id, setTab])

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

  const extraActive = extraTabs.find((item) => item.id === tab)
  const ExtraComponent = extraActive?.entry.Component

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
          {extraTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tabClass(tab === item.id)}
              onClick={() => setTab(item.id)}
              data-testid={`inspector-tab-${item.id}`}
            >
              {item.Icon ? <item.Icon className="size-3.5" /> : <LuLayoutGrid className="size-3.5" />}
              {item.label}
            </button>
          ))}
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
          tab === 'traj' || extraActive ? 'flex flex-col overflow-hidden' : 'overflow-auto p-2.5'
        }`}
      >
        {tab === 'traj' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="inspector-trajectory">
            <TrajectoryView useSessionView={useSessionView} sessionView={sessionView} renderSlot={() => null} />
          </div>
        ) : null}

        {extraActive && ExtraComponent ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid={`inspector-${extraActive.id}`}>
            <ExtraComponent {...(extraActive.entry.props?.() ?? {})} renderSlot={renderSlot} />
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
