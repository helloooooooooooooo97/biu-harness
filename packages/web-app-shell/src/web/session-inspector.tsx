import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircleIcon,
  DocumentTextIcon,
  ListBulletIcon,
  PlusIcon,
  Squares2X2Icon,
  TableCellsIcon,
  TrashIcon,
  ViewColumnsIcon,
} from '@heroicons/react/16/solid'
import { chromeIcon } from './chrome-icon.ts'
import {
  bindSessionView,
  type InspectorCenterKind,
  type SessionViewService,
} from '@biu/web-session-view'
import { useSlotEntries } from '@biu/web-slots'
import type { SlotsService } from '@biu/web-slots'
import { inspectorTabFromEvent, requestInspectorAction } from './chat-overlay.ts'
import { getInspectorCaption, getInspectorCaptionVersion, subscribeInspectorCaptions } from './inspector-captions.ts'
import { inspectorPanelMatches, inspectorViewProps, nextRepeatableTabId, resolveInspectorTab, slotTabId } from './inspector-panels.ts'

function PaneLeafIcon({
  kind,
  mode,
  emoji,
  Fallback,
}: {
  kind?: string
  mode?: string
  emoji?: string
  Fallback?: ComponentType<{ className?: string }>
}) {
  if (kind === 'record') {
    if (emoji) return <span className="fsdb-record-emoji" aria-hidden>{emoji}</span>
    return <DocumentTextIcon {...chromeIcon} />
  }
  if (kind === 'view') {
    if (mode === 'queue') return <ListBulletIcon {...chromeIcon} />
    if (mode === 'board') return <ViewColumnsIcon {...chromeIcon} />
    if (mode === 'cards') return <Squares2X2Icon {...chromeIcon} />
    return <TableCellsIcon {...chromeIcon} />
  }
  if (Fallback) return <Fallback {...chromeIcon} />
  return <Squares2X2Icon {...chromeIcon} />
}

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

function inspectorOpenedKey(sid: string | null | undefined) {
  return sid ? `inspector.opened:${sid}` : 'inspector.opened:home'
}

function readOpened(sid: string | null | undefined): string[] {
  try {
    const raw = localStorage.getItem(inspectorOpenedKey(sid))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
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
  const captionRev = useSyncExternalStore(subscribeInspectorCaptions, getInspectorCaptionVersion, () => 0)
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
          Tab: extra.Tab as ComponentType<Record<string, unknown>> | undefined,
          ensureTrajectory: Boolean(extra.ensureTrajectory),
          focusOnCall: Boolean(extra.focusOnCall),
          common: Boolean(extra.common),
          repeatable: Boolean(extra.repeatable),
          action: typeof extra.action === 'string' ? extra.action : '',
        }]
      })
  }, [centerKind, extras, sessionId])
  const allowedTabs = useMemo(() => extraTabs.map((item) => item.id), [extraTabs])
  const displayTabs = extraTabs.filter((item) => !item.action)
  const toolTabs = extraTabs.filter((item) => item.action)

  const [tab, setTabState] = useState('')
  const [opened, setOpened] = useState(() => readOpened(sessionId))
  const [plusOpen, setPlusOpen] = useState(false)
  const plusRef = useRef<HTMLDivElement>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)
  const [plusPos, setPlusPos] = useState<{ right: number; top: number } | null>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
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
  const persistOpened = useCallback(
    (next: string[]) => {
      setOpened(next)
      try {
        localStorage.setItem(inspectorOpenedKey(sessionId), JSON.stringify(next))
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
      persistOpened(opened.includes(focusTabId) ? opened : [...opened, focusTabId])
      setTab(focusTabId)
      return
    }
    setTabState((current) => resolveInspectorTab(current, allowedTabs))
  }, [sessionId, focusCallId, focusTabId, allowedTabs.join('|'), setTab])

  useEffect(() => {
    const onTab = (event: Event) => {
      const next = inspectorTabFromEvent(event)
      if (next && allowedTabs.includes(next)) {
        persistOpened(opened.includes(next) ? opened : [...opened, next])
        setTab(next)
      }
    }
    window.addEventListener('biu:inspector-tab', onTab)
    return () => window.removeEventListener('biu:inspector-tab', onTab)
  }, [allowedTabs.join('|'), opened, persistOpened, setTab])

  useEffect(() => {
    if (!open) return
    const current = extraTabs.find((item) => item.id === tab)
    if (current?.ensureTrajectory) void sessionView.ensureTrajectory()
  }, [open, tab, sessionId, sessionView, extraTabs])

  useLayoutEffect(() => {
    if (!plusOpen) {
      setPlusPos(null)
      return
    }
    const box = plusRef.current?.getBoundingClientRect()
    if (!box) return
    setPlusPos({
      right: Math.max(8, window.innerWidth - box.right),
      top: box.bottom + 4,
    })
  }, [plusOpen])

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (plusRef.current?.contains(target) || plusMenuRef.current?.contains(target)) return
      setPlusOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    return () => window.removeEventListener('mousedown', onPointer)
  }, [])

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

  useEffect(() => {
    const activeTab = tabsRef.current?.querySelector<HTMLElement>('.inspector-tab.is-active, .inspector-crumb-tab.is-active')
    activeTab?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [tab])

  const headerTabs = opened.flatMap((openedId) => {
    const item = displayTabs.find((tabItem) => tabItem.id === slotTabId(openedId))
    if (!item) return []
    return [{ ...item, id: openedId }]
  })
  const extraActive = headerTabs.find((item) => item.id === tab) ?? displayTabs.find((item) => item.id === tab)
  const ExtraComponent = extraActive?.entry.Component

  function pickOffer(item: (typeof extraTabs)[number]) {
    if (item.action) {
      requestInspectorAction(item.action)
      return
    }
    if (item.repeatable) {
      const instanceId = nextRepeatableTabId(item.id)
      persistOpened([...opened, instanceId])
      setTab(instanceId)
      return
    }
    persistOpened(opened.includes(item.id) ? opened : [...opened, item.id])
    setTab(item.id)
  }

  function closeOpenedTab(id: string) {
    const next = opened.filter((item) => item !== id)
    persistOpened(next)
    if (tab === id) setTab(next.at(-1) ?? '')
  }

  if (!open) return null

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
        <div className="inspector-tabs" ref={tabsRef} role="tablist" aria-label="检查器分区">
          {headerTabs.map((item) => {
            const active = tab === item.id
            const Tab = item.Tab
            if (Tab) {
              const raw = (item.entry.props?.() ?? {}) as Record<string, unknown>
              return (
                <Tab
                  key={item.id}
                  active={active}
                  onActivate={() => setTab(item.id)}
                  {...inspectorViewProps(raw)}
                  paneId={item.id}
                />
              )
            }
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
        <div className="inspector-add" ref={plusRef}>
          <button
            type="button"
            className={`chat-view-header-expand${plusOpen ? ' is-active' : ''}`}
            title="添加"
            aria-label="添加可展示的内容"
            aria-expanded={plusOpen}
            data-testid="inspector-add"
            onClick={() => setPlusOpen((prev) => !prev)}
          >
            <PlusIcon {...chromeIcon} />
          </button>
          {plusOpen && plusPos
            ? createPortal(
            <div
              ref={plusMenuRef}
              className="inspector-add-menu is-fixed"
              role="menu"
              data-testid="inspector-add-menu"
              data-caption-rev={captionRev}
              style={{ right: plusPos.right, top: plusPos.top }}
            >
              <div className="inspector-add-head">面板</div>
              {headerTabs.length ? (
                headerTabs.map((item) => {
                  const caption = getInspectorCaption(item.id)
                  return (
                  <div key={item.id} className={`inspector-add-row${tab === item.id ? ' is-active' : ''}`}>
                    <button
                      type="button"
                      className="inspector-add-row-main"
                      role="menuitem"
                      onClick={() => setTab(item.id)}
                      data-testid={`inspector-offer-${item.id}`}
                    >
                      <PaneLeafIcon kind={caption?.kind} mode={caption?.mode} emoji={caption?.emoji} Fallback={item.Icon} />
                      <span className="min-w-0 flex-1 truncate">{caption?.label || item.label}</span>
                      <CheckCircleIcon aria-hidden className="size-4 shrink-0 inspector-add-check" />
                    </button>
                    {item.repeatable ? (
                      <button
                        type="button"
                        className="inspector-add-trash"
                        title="从检查器移除"
                        aria-label="从检查器移除"
                        data-testid={`inspector-tab-remove-${item.id}`}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          closeOpenedTab(item.id)
                        }}
                      >
                        <TrashIcon {...chromeIcon} />
                      </button>
                    ) : null}
                  </div>
                  )
                })
              ) : (
                <div className="inspector-add-empty">还没有打开的面板</div>
              )}
              <div className="inspector-add-foot">
                {displayTabs
                  .filter((item) => item.repeatable || !opened.some((id) => slotTabId(id) === item.id))
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="inspector-catalog-item"
                      role="menuitem"
                      onClick={() => pickOffer(item)}
                      data-testid={`inspector-offer-add-${item.id}`}
                    >
                      {item.Icon ? <item.Icon {...chromeIcon} /> : <Squares2X2Icon {...chromeIcon} />}
                      <span className="min-w-0 flex-1 truncate">{item.repeatable ? `添加${item.label}` : item.label}</span>
                    </button>
                  ))}
                {toolTabs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="inspector-catalog-item"
                    role="menuitem"
                    onClick={() => pickOffer(item)}
                    data-testid={`inspector-offer-${item.id}`}
                  >
                    {item.Icon ? <item.Icon {...chromeIcon} /> : <Squares2X2Icon {...chromeIcon} />}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
          : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {extraActive && ExtraComponent ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid={`inspector-${extraActive.id}`}>
            <ExtraComponent {...inspectorViewProps((extraActive.entry.props?.() ?? {}) as Record<string, unknown>)} paneId={extraActive.id} renderSlot={renderSlot} />
          </div>
        ) : (
          <p className="inspector-catalog-empty" data-testid="inspector-catalog">
            点右上角加号，选择要展示的内容
          </p>
        )}
      </div>
    </aside>
  )
})
