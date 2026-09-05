import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircleIcon,
  ListBulletIcon,
  PlusIcon,
  Squares2X2Icon,
  XMarkIcon,
  TableCellsIcon,
  ViewColumnsIcon,
  ChatBubbleLeftRightIcon,
  DocumentIcon,
  PuzzlePieceIcon,
  RectangleStackIcon,
  TagIcon,
  BoltIcon,
  EyeIcon,
} from '@heroicons/react/16/solid'
import { chromeIcon } from './chrome-icon.ts'
import {
  bindSessionView,
  type SessionViewService,
} from '@biu/web-session-view'
import { useSlotEntries } from '@biu/web-slots'
import type { SlotsService } from '@biu/web-slots'
import { inspectorTabFromEvent, requestInspectorAction } from './chat-overlay.ts'
import { getInspectorCaption, getInspectorCaptionVersion, subscribeInspectorCaptions } from './inspector-captions.ts'
import { inspectorPanelMatches, inspectorViewProps, nextRepeatableTabId, pruneOpenedForCollections, resolveInspectorTab, slotTabId } from './inspector-panels.ts'
import { HeadlessDismiss } from '@biu/public-ui'
import { SidebarMascot, resolveSessionMascot } from '@biu/public-mascot'

function captionTableIcon(icon?: string) {
  const name = (icon ?? '').trim().toLowerCase()
  if (name === 'puzzle-piece' || name === 'puzzle') return PuzzlePieceIcon
  if (name === 'tag') return TagIcon
  if (name === 'rectangle-stack' || name === 'collection') return RectangleStackIcon
  if (name === 'check-circle' || name === 'check' || name === 'clipboard-document-list' || name === 'clipboard') return CheckCircleIcon
  if (name === 'chat-bubble' || name === 'chat-bubble-left-right') return ChatBubbleLeftRightIcon
  if (name === 'document' || name === 'document-text' || name === 'page') return DocumentIcon
  if (name === 'bolt') return BoltIcon
  if (name === 'eye') return EyeIcon
  return TableCellsIcon
}

function PaneLeafIcon({
  kind,
  mode,
  icon,
  emoji,
  Fallback,
}: {
  kind?: string
  mode?: string
  icon?: string
  emoji?: string
  Fallback?: ComponentType<{ className?: string }>
}) {
  if (kind === 'record' && emoji) {
    return <span className="fsdb-record-emoji">{emoji}</span>
  }
  if (kind === 'record' || kind === 'collection') {
    const Glyph = captionTableIcon(icon)
    return <Glyph {...chromeIcon} />
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
  onWidthLive?: (width: number) => void
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView: SessionViewService
  slots: SlotsService
  renderSlot: (name: string) => ReactNode
  collections?: Array<{ path: string }>
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
  onWidthLive,
  useSessionView,
  sessionView,
  slots,
  renderSlot,
  collections,
}: SessionInspectorProps) {
  const sessionId = useSessionView((state) => state.sessionId)
  const sessions = useSessionView((state) => state.sessions)
  const currentSession = sessions.find((item) => item.id === sessionId)
  const sessionIdentity = sessionId ? resolveSessionMascot(sessionId, currentSession?.mascot) : null
  const sessionLabel = (currentSession?.title || '').trim() || (sessionIdentity ? `${sessionIdentity.shape}` : '')
  const focusCallId = useSessionView((state) => state.focusCallId)
  const extras = useSlotEntries(slots, 'inspector-panels')
  const captionRev = useSyncExternalStore(subscribeInspectorCaptions, getInspectorCaptionVersion, () => 0)
  const extraTabs = useMemo(() => {
    return [...extras]
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
      .flatMap((entry) => {
        const extra = entry.props?.() ?? {}
        if (!inspectorPanelMatches(extra, sessionId)) return []
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
  }, [extras, sessionId])
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
      window.dispatchEvent(new CustomEvent('biu:inspector-opened', { detail: { sessionId, opened: next } }))
    },
    [sessionId],
  )

  useEffect(() => {
    const next = pruneOpenedForCollections(opened, collections)
    if (next.length === opened.length) return
    persistOpened(next)
  }, [collections, opened, persistOpened])
  const dragRef = useRef<{ startX: number; startWidth: number; last: number } | null>(null)

  useEffect(() => {
    setOpened(readOpened(sessionId))
    try {
      setTabState(localStorage.getItem(inspectorTabStorageKey(sessionId)) ?? '')
    } catch {
      setTabState('')
    }
  }, [sessionId])

  const focusTabId = extraTabs.find((item) => item.focusOnCall)?.id
  useEffect(() => {
    if (!focusCallId || !focusTabId) return
    setOpened((prev) => {
      if (prev.includes(focusTabId)) return prev
      const next = [...prev, focusTabId]
      try {
        localStorage.setItem(inspectorOpenedKey(sessionId), JSON.stringify(next))
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent('biu:inspector-opened', { detail: { sessionId, opened: next } }))
      return next
    })
    setTab(focusTabId)
  }, [focusCallId, focusTabId, sessionId, setTab])

  useEffect(() => {
    if (focusCallId && focusTabId) return
    setTabState((current) => {
      const next = resolveInspectorTab(current, allowedTabs, opened)
      if (next !== current) {
        try {
          localStorage.setItem(inspectorTabStorageKey(sessionId), next)
        } catch {
          /* ignore */
        }
      }
      return next
    })
  }, [sessionId, focusCallId, focusTabId, allowedTabs.join('|'), opened])

  useEffect(() => {
    const onTab = (event: Event) => {
      const next = inspectorTabFromEvent(event)
      if (!next) return
      const allowed = allowedTabs.includes(next) || allowedTabs.includes(slotTabId(next))
      if (!allowed) return
      const existing = opened.find((id) => id === next || slotTabId(id) === next)
      const id = existing ?? next
      persistOpened(opened.includes(id) ? opened : [...opened, id])
      setTab(id)
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
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const next = drag.startWidth + (drag.startX - event.clientX)
      drag.last = next
      if (onWidthLive) onWidthLive(next)
      else onWidthChange(next)
    }
    const onUp = () => {
      const drag = dragRef.current
      dragRef.current = null
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
      if (drag && onWidthLive) onWidthChange(drag.last)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [onWidthChange, onWidthLive])

  useEffect(() => {
    const activeTab = tabsRef.current?.querySelector<HTMLElement>('.inspector-tab.is-active, .inspector-crumb-tab.is-active')
    activeTab?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [tab])

  const headerTabs = opened.flatMap((openedId) => {
    const item = displayTabs.find((tabItem) => tabItem.id === slotTabId(openedId))
    if (!item) return []
    return [{ ...item, id: openedId }]
  })
  const extraActive = headerTabs.find((item) => item.id === tab)

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
    if (slotTabId(id) === focusTabId) sessionView.clearInspectCall()
    const next = opened.filter((item) => item !== id)
    persistOpened(next)
    if (tab === id) setTab(next.at(-1) ?? '')
  }

  return (
    <aside
      className={`session-inspector relative flex min-h-0 min-w-0 flex-col bg-(--dsw-sidebar) text-(--dsw-label)${open ? '' : ' is-closed'}`}
      data-testid="session-inspector"
      aria-label="会话检查器"
      aria-hidden={!open}
      inert={!open || undefined}
    >
      <div
        className="inspector-resize"
        data-biu-ignore
        data-testid="inspector-resize"
        title="拖动调整宽度"
        onPointerDown={(event) => {
          event.preventDefault()
          const visual = event.currentTarget.parentElement?.getBoundingClientRect().width ?? width
          dragRef.current = { startX: event.clientX, startWidth: visual, last: visual }
          document.body.style.cursor = 'col-resize'
          document.body.style.userSelect = 'none'
        }}
      />

      <div className="app-side-bar-head" data-biu-ignore>
        <div className="inspector-tabs" ref={tabsRef} role="tablist" aria-label="检查器分区">
          {headerTabs.map((item) => {
            const active = tab === item.id
            const Tab = item.Tab
            if (Tab) {
              const raw = (item.entry.props?.() ?? {}) as Record<string, unknown>
              return (
                <Tab
                  key={item.id}
                  {...inspectorViewProps(raw)}
                  active={active}
                  onActivate={() => setTab(item.id)}
                  onClose={() => closeOpenedTab(item.id)}
                  paneId={item.id}
                />
              )
            }
            return (
              <div
                key={item.id}
                role="tab"
                aria-selected={active}
                className={`inspector-tab${active ? ' is-active' : ''}`}
                data-testid={`inspector-tab-${item.id}`}
              >
                <button
                  type="button"
                  className="inspector-tab-main"
                  onClick={() => setTab(item.id)}
                >
                  <span className="inspector-tab-indicator" aria-hidden />
                  {item.Icon ? <item.Icon {...chromeIcon} /> : <Squares2X2Icon {...chromeIcon} />}
                  {item.label}
                </button>
                <span className="inspector-crumb-actions">
                  <button
                    type="button"
                    className="inspector-crumb-close"
                    title="关闭"
                    aria-label="关闭此栏"
                    data-testid={`inspector-tab-close-${item.id}`}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      closeOpenedTab(item.id)
                    }}
                  >
                    <XMarkIcon {...chromeIcon} />
                  </button>
                </span>
              </div>
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
            <HeadlessDismiss onDismiss={() => setPlusOpen(false)} insideRef={plusRef}>
            <div
              ref={plusMenuRef}
              className="inspector-add-menu is-fixed"
              role="menu"
              data-biu-ignore
              data-testid="inspector-add-menu"
              data-caption-rev={captionRev}
              style={{ right: plusPos.right, top: plusPos.top }}
            >
              {sessionId && sessionIdentity ? (
                <div className={`inspector-add-owner${headerTabs.length ? ' has-open' : ''}`} data-testid="inspector-add-owner">
                  <SidebarMascot
                    size={22}
                    sessionId={sessionId}
                    identity={sessionIdentity}
                    busy={Boolean(currentSession?.busy)}
                    animate={false}
                    title={sessionLabel}
                  />
                  <span className="min-w-0 flex-1 truncate">{sessionLabel}</span>
                </div>
              ) : null}
              {headerTabs.map((item) => {
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
                      <PaneLeafIcon kind={caption?.kind} mode={caption?.mode} icon={caption?.icon} emoji={caption?.emoji} Fallback={item.Icon} />
                      <span className="min-w-0 flex-1 truncate">{caption?.label || item.label}</span>
                      <CheckCircleIcon aria-hidden className="size-4 shrink-0 inspector-add-check" />
                    </button>
                    <button
                      type="button"
                      className="inspector-add-close"
                      title="关闭"
                      aria-label="关闭此栏"
                      data-testid={`inspector-tab-remove-${item.id}`}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        closeOpenedTab(item.id)
                      }}
                    >
                      <XMarkIcon {...chromeIcon} />
                    </button>
                  </div>
                )
              })}
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
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
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
            </div>
            </HeadlessDismiss>,
            document.body,
          )
          : null}
        </div>
      </div>

      <div className="inspector-stage">
        {headerTabs.map((item) => {
          const Pane = item.entry.Component
          if (!Pane) return null
          const active = item.id === tab
          return (
            <div
              key={item.id}
              className={`inspector-stage-pane${active ? ' is-active' : ''}`}
              data-testid={`inspector-${item.id}`}
              aria-hidden={!active}
              inert={!active || undefined}
            >
              <Pane {...inspectorViewProps((item.entry.props?.() ?? {}) as Record<string, unknown>)} paneId={item.id} renderSlot={renderSlot} />
            </div>
          )
        })}
        <div
          className={`inspector-stage-pane inspector-empty${extraActive ? '' : ' is-active'}`}
          data-testid="inspector-catalog"
          aria-hidden={Boolean(extraActive)}
          inert={extraActive ? true : undefined}
        >
          {displayTabs.length || toolTabs.length ? (
            <div className="inspector-empty-list">
              {displayTabs
                .filter((item) => item.repeatable || !opened.some((id) => slotTabId(id) === item.id))
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="inspector-empty-item"
                    onClick={() => pickOffer(item)}
                    data-testid={`inspector-empty-${item.id}`}
                  >
                    {item.Icon ? <item.Icon {...chromeIcon} /> : <Squares2X2Icon {...chromeIcon} />}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </button>
                ))}
              {toolTabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="inspector-empty-item"
                  onClick={() => pickOffer(item)}
                  data-testid={`inspector-empty-${item.id}`}
                >
                  {item.Icon ? <item.Icon {...chromeIcon} /> : <Squares2X2Icon {...chromeIcon} />}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  )
})
