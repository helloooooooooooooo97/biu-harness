import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { Squares2X2Icon, ChevronDoubleRightIcon } from '@heroicons/react/16/solid'
import { chromeIcon } from './chrome-icon.ts'
import {
  bindSessionView,
  type SessionViewService,
} from '@biu/web-session-view'
import { useSlotEntries } from '@biu/web-slots'
import type { SlotsService } from '@biu/web-slots'

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
            ensureTrajectory: Boolean(extra.ensureTrajectory),
            focusOnCall: Boolean(extra.focusOnCall),
          }
        }),
    [extras],
  )
  const allowedTabs = useMemo(() => extraTabs.map((item) => item.id), [extraTabs])
  const defaultTab = extraTabs[0]?.id ?? ''

  const [tab, setTabState] = useState(() => inspectorStoredTab(sessionId, allowedTabs) ?? defaultTab)
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
      const focus = extraTabs.find((item) => item.focusOnCall)
      if (focus) setTab(focus.id)
      return
    }
    setTabState(inspectorStoredTab(sessionId, allowedTabs) ?? defaultTab)
  }, [sessionId, focusCallId, allowedTabs.join('|'), defaultTab, setTab, extraTabs])

  useEffect(() => {
    if (!open) return
    const current = extraTabs.find((item) => item.id === tab)
    if (current?.ensureTrajectory) void sessionView.ensureTrajectory()
  }, [open, tab, sessionId, sessionView, extraTabs])

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
      className="relative flex min-h-0 min-w-0 flex-col border-l border-[var(--dsw-border)] bg-[var(--dsw-bg)] text-[var(--dsw-label)]"
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

      <div className="app-side-bar-head">
        <div className="inspector-tabs" role="tablist" aria-label="检查器分区">
          {extraTabs.map((item) => {
            const active = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`inspector-tab${active ? ' is-active' : ''}`}
                onClick={() => setTab(item.id)}
                data-testid={`inspector-tab-${item.id}`}
              >
                <span className="inspector-tab-indicator" aria-hidden />
                {item.Icon ? <item.Icon {...chromeIcon} /> : <Squares2X2Icon {...chromeIcon} />}
                {item.label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          className="grid size-6 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent text-[var(--dsw-label-3)] hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-business)]"
          title="收起右侧栏"
          aria-label="收起右侧栏"
          onClick={onClose}
        >
          <ChevronDoubleRightIcon {...chromeIcon} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {extraActive && ExtraComponent ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid={`inspector-${extraActive.id}`}>
            <ExtraComponent {...(extraActive.entry.props?.() ?? {})} renderSlot={renderSlot} />
          </div>
        ) : null}
      </div>
    </aside>
  )
})
