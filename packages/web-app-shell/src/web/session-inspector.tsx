import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { Squares2X2Icon } from '@heroicons/react/16/solid'
import { chromeIcon } from './chrome-icon.ts'
import {
  bindSessionView,
  type InspectorCenterKind,
  type SessionViewService,
} from '@biu/web-session-view'
import { useSlotEntries } from '@biu/web-slots'
import type { SlotsService } from '@biu/web-slots'
import { inspectorTabFromEvent } from './chat-overlay.ts'
import { inspectorPanelMatches } from './inspector-panels.ts'

export type SessionInspectorProps = {
  open: boolean
  width: number
  onWidthChange: (width: number) => void
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView: SessionViewService
  slots: SlotsService
  renderSlot: (name: string) => ReactNode
  centerKind: InspectorCenterKind
}

function inspectorTabStorageKey(sid: string | null | undefined) {
  return sid ? `inspector.tab:${sid}` : 'inspector.tab:home'
}

function inspectorStoredTab(sid: string | null | undefined, allowed: string[]): string | undefined {
  try {
    const raw = localStorage.getItem(inspectorTabStorageKey(sid))
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
  useSessionView,
  sessionView,
  slots,
  renderSlot,
  centerKind,
}: SessionInspectorProps) {
  const sessionId = useSessionView((state) => state.sessionId)
  const focusCallId = useSessionView((state) => state.focusCallId)
  const extras = useSlotEntries(slots, 'inspector-panels')
  const extraTabs = useMemo(() => {
    return [...extras]
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
      .flatMap((entry) => {
        const extra = entry.props?.() ?? {}
        if (!inspectorPanelMatches(extra, centerKind, sessionId)) return []
        return [{
          entry,
          id: String(extra.tabId ?? entry.id),
          label: String(extra.tabLabel ?? '插件'),
          Icon: extra.tabIcon as ComponentType<{ className?: string }> | undefined,
          ensureTrajectory: Boolean(extra.ensureTrajectory),
          focusOnCall: Boolean(extra.focusOnCall),
        }]
      })
  }, [centerKind, extras, sessionId])
  const allowedTabs = useMemo(() => extraTabs.map((item) => item.id), [extraTabs])
  const defaultTab = extraTabs[0]?.id ?? ''

  const [tab, setTabState] = useState(() => inspectorStoredTab(sessionId, allowedTabs) ?? defaultTab)
  const setTab = useCallback(
    (next: string) => {
      setTabState(next)
      try {
        localStorage.setItem(inspectorTabStorageKey(sessionId), next)
      } catch {
        /* ignore */
      }
    },
    [sessionId],
  )
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const focusTabId = extraTabs.find((item) => item.focusOnCall)?.id
  useEffect(() => {
    if (focusCallId && focusTabId) {
      setTab(focusTabId)
      return
    }
    // 无 session 时没有可用的 stored key 旧逻辑会每次 extras 刷新都打回 defaultTab，任务/插件点了等于没点。
    setTabState((current) => {
      const stored = inspectorStoredTab(sessionId, allowedTabs)
      if (stored) return stored
      if (current && allowedTabs.includes(current)) return current
      return defaultTab
    })
  }, [sessionId, focusCallId, focusTabId, allowedTabs.join('|'), defaultTab, setTab])

  useEffect(() => {
    const onTab = (event: Event) => {
      const next = inspectorTabFromEvent(event)
      if (next && allowedTabs.includes(next)) setTab(next)
    }
    window.addEventListener('biu:inspector-tab', onTab)
    return () => window.removeEventListener('biu:inspector-tab', onTab)
  }, [allowedTabs.join('|'), setTab])

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
      className="session-inspector relative flex min-h-0 min-w-0 flex-col bg-(--dsw-bg) text-(--dsw-label)"
      data-testid="session-inspector"
      aria-label="会话检查器"
    >
      <div
        className="inspector-resize"
        data-testid="inspector-resize"
        title="拖动调整宽度"
        onPointerDown={(event) => {
          event.preventDefault()
          const visual = event.currentTarget.parentElement?.getBoundingClientRect().width ?? width
          dragRef.current = { startX: event.clientX, startWidth: visual }
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
