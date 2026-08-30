import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  clampOverlayChatHeight,
  OVERLAY_CHAT_HEIGHT_DEFAULT,
  OVERLAY_CHAT_HEIGHT_MIN,
  getChatOverlay,
  subscribeChatOverlay,
  getOverlayThread,
  subscribeOverlayThread,
  getOverlayAutohide,
  setOverlayAutohide,
  subscribeOverlayAutohide,
  requestOverlayAutohide,
  overlayStillHoldsPointer,
  setOverlayResizing,
  getOverlayPinned,
  subscribeOverlayPinned,
  toggleOverlayPinned,
  requestInspectorClose,
  allocateShellColumns,
  clampSidebarWidth,
  SIDEBAR_DEFAULT,
  SIDEBAR_LABEL_AT,
  SIDEBAR_TAG_AT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
} from './chat-overlay.ts'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Context } from 'cordis'
import type { SlotProps } from '@biu/web-slots'
import { bindSnapshot, type SnapshotService } from '@biu/web-snapshot'
import { bindSessionView, type SessionViewService } from '@biu/web-session-view'
import { bindProjectView, type ProjectViewService } from '@biu/web-project-view'
import { parseAppPath } from '@biu/web-session-view'
import {
  isMascotDancing,
  mascotDanceShape,
  subscribeMascotDance,
} from '@biu/web-mascot'
import {
  bindAppModules,
  bindAppModulesNavReady,
  moduleIdFromPath,
  type AppModule,
  type AppModulesService,
} from '@biu/web-app-modules'
import { ChatSidebar } from './chat-sidebar.tsx'
import { ShellSidebarFrame } from './shell-sidebar-frame.tsx'
import { ChatSessionTitle } from './chat-session-title.tsx'
import { BrandCornerMascot, DanceStage } from '@biu/web-mascot'
import { SessionInspector } from './session-inspector.tsx'
import { SessionConfigDialog } from '@biu/web-session-view/dialog'
import { FolderGlyph } from '@biu/web-session-view/folder-glyph'
import { useSlotEntries } from '@biu/web-slots'
import type { SlotsService } from '@biu/web-slots'
import { chromeIcon } from './chrome-icon.ts'
import {
  ArrowDownTrayIcon,
  ChatBubbleLeftIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  Cog6ToothIcon,
  AdjustmentsHorizontalIcon,
  MapPinIcon,
} from '@heroicons/react/16/solid'

export const name = 'shell'
export const inject = ['slots', 'snapshot', 'sessionView', 'projectView', 'appModules']

function ModuleIcon({ module }: { module: AppModule }) {
  if (module.Icon) {
    const Icon = module.Icon
    return <Icon {...chromeIcon} />
  }
  return <ChatBubbleLeftIcon {...chromeIcon} aria-hidden />
}

function ModuleRail({
  active,
  agentHref,
  modules,
  pinned,
  onTogglePin,
  onSettings,
}: {
  active: string
  agentHref: string
  modules: AppModule[]
  pinned: boolean
  onTogglePin: () => void
  onSettings: () => void
}) {
  return (
    <nav className="app-activity-bar" aria-label="Activity bar" data-biu-ignore>
      <div className="app-activity-list">
        {modules.map((module) => {
          const to = module.id === 'agent' ? agentHref : module.path
          const isActive = module.id === active
          return (
            <Link
              key={module.id}
              to={to}
              className={`app-activity-item${isActive ? ' is-active' : ''}`}
              title={module.label}
              aria-label={module.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={
                isActive
                  ? (event) => {
                      event.preventDefault()
                    }
                  : undefined
              }
            >
              <span className="app-activity-indicator" aria-hidden />
              <ModuleIcon module={module} />
              <span className="sr-only">{module.label}</span>
            </Link>
          )
        })}
      </div>
      <div className="app-activity-footer">
        <button
          type="button"
          className={`app-activity-item app-activity-pin${pinned ? ' is-active' : ''}`}
          title={pinned ? '取消固定左侧导航' : '固定左侧导航'}
          aria-label={pinned ? '取消固定左侧导航' : '固定左侧导航'}
          aria-pressed={pinned}
          data-testid="activity-rail-pin"
          onClick={onTogglePin}
        >
          <MapPinIcon {...chromeIcon} />
        </button>
        <UpdateButton />
        <button
          type="button"
          className="app-activity-item app-activity-settings"
          title="Settings"
          aria-label="Settings"
          onClick={onSettings}
        >
          <Cog6ToothIcon {...chromeIcon} />
        </button>
      </div>
    </nav>
  )
}

function UpdateButton() {
  const [behind, setBehind] = useState(0)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | undefined>()

  useEffect(() => {
    void fetch('/api/update')
      .then((res) => res.json() as Promise<{ behind?: number }>)
      .then((data) => setBehind(Math.max(0, Number(data.behind) || 0)))
      .catch(() => { })
  }, [])

  useEffect(() => {
    if (!hint || behind > 0 || busy) return
    const timer = window.setTimeout(() => setHint(undefined), 3200)
    return () => window.clearTimeout(timer)
  }, [hint, behind, busy])

  const download = useCallback(async () => {
    if (busy) return
    if (behind <= 0) {
      setHint('相对于主分支暂时无最新提交版本')
      return
    }
    setBusy(true)
    setHint(undefined)
    try {
      const res = await fetch('/api/update', { method: 'POST' })
      const data = (await res.json()) as { error?: string; restarting?: boolean }
      if (!res.ok) throw new Error(data.error || '更新失败')
      setBehind(0)
      setHint('正在重启…')
    } catch (error) {
      setBusy(false)
      setHint(String(error))
    }
  }, [busy, behind])

  const idle = behind <= 0 && !busy
  const label = hint ?? (behind > 0 ? `下载更新 · 落后 ${behind}` : '下载更新')
  const badge = behind > 99 ? '99+' : String(behind)

  return (
    <button
      type="button"
      className={`app-activity-item app-activity-update${busy ? ' is-busy' : ''}${idle ? ' is-idle' : ''}`}
      title={label}
      aria-label={label}
      aria-disabled={idle}
      disabled={busy}
      onClick={() => void download()}
    >
      <ArrowDownTrayIcon {...chromeIcon} />
      {behind > 0 && !busy ? (
        <span className="app-activity-badge" aria-hidden>
          {badge}
        </span>
      ) : null}
      {hint && idle ? (
        <span className="app-activity-update-toast" role="status">
          {hint}
        </span>
      ) : null}
    </button>
  )
}

/** 主区固定聊天；轨迹改在右侧检查器。悬浮形态可挂到任意页面最顶层。 */
const AgentMainPanels = memo(function AgentMainPanels({
  renderSlot,
  header,
  floating,
  withSidebar,
  railOpen,
  showCenter,
}: {
  renderSlot: SlotProps['renderSlot']
  header: ReactNode
  floating: boolean
  withSidebar: boolean
  railOpen: boolean
  showCenter: boolean
}) {
  const overlay = floating
  const overlayOpen = useSyncExternalStore(subscribeChatOverlay, getChatOverlay, () => false)
  const threadOpen = useSyncExternalStore(subscribeOverlayThread, getOverlayThread, () => false)
  const [overlayMounted, setOverlayMounted] = useState(false)
  const [heldCenter, setHeldCenter] = useState(showCenter)
  if (showCenter && !heldCenter) setHeldCenter(true)
  useEffect(() => {
    setOverlayMounted(true)
  }, [])
  const hidden = useSyncExternalStore(subscribeOverlayAutohide, getOverlayAutohide, () => false)
  const stageRef = useRef<HTMLDivElement>(null)
  const heightRef = useRef(OVERLAY_CHAT_HEIGHT_DEFAULT)
  const [overlayChatHeight, setOverlayChatHeight] = useState(() => {
    try {
      const raw = localStorage.getItem('cordis.overlay.chatHeight')
      if (raw == null) return OVERLAY_CHAT_HEIGHT_DEFAULT
      const n = Number(raw)
      if (!Number.isFinite(n)) return OVERLAY_CHAT_HEIGHT_DEFAULT
      return clampOverlayChatHeight(n, typeof window === 'undefined' ? 800 : window.innerHeight - 20)
    } catch {
      return OVERLAY_CHAT_HEIGHT_DEFAULT
    }
  })
  heightRef.current = overlayChatHeight
  const keepVisible = useCallback(() => {
    setOverlayAutohide(false)
  }, [])
  const hideIfIdle = useCallback(
    (event?: { currentTarget: EventTarget; relatedTarget: EventTarget | null; clientX: number; clientY: number }) => {
      if (!overlay) return
      const panel = event?.currentTarget ?? null
      const related = event?.relatedTarget ?? null
      const x = event?.clientX
      const y = event?.clientY
      queueMicrotask(() => {
        if (overlayStillHoldsPointer(panel, related, x, y)) return
        requestOverlayAutohide()
      })
    },
    [overlay],
  )
  useEffect(() => {
    if (!overlay) setOverlayAutohide(false)
  }, [overlay])
  useEffect(() => {
    if (!overlay) return
    const el = stageRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [overlay])
  const onResizeHeight = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setOverlayResizing(true)
    const startH = heightRef.current
    const originY = event.clientY
    const panel = event.currentTarget.closest('.chat-overlay-panel')
    const chrome = panel instanceof HTMLElement ? Math.max(0, panel.offsetHeight - heightRef.current) : 180
    const maxH = Math.max(OVERLAY_CHAT_HEIGHT_MIN, window.innerHeight - 20 - chrome)
    const onMove = (move: globalThis.PointerEvent) => {
      const next = clampOverlayChatHeight(startH + (originY - move.clientY), maxH)
      setOverlayChatHeight(next)
      heightRef.current = next
    }
    const onUp = (up: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setOverlayResizing(false)
      try {
        localStorage.setItem('cordis.overlay.chatHeight', String(heightRef.current))
      } catch {
        /* ignore */
      }
      const hit = document.elementFromPoint(up.clientX, up.clientY)
      if (!hit?.closest('.chat-overlay-panel')) requestOverlayAutohide()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [])

  const centerStage = (
    <div className="chat-stage flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 py-3 pb-44 md:px-8 lg:px-10">
      {renderSlot('stage')}
    </div>
  )
  const overlayStage = (
    <div
      ref={stageRef}
      className="chat-stage flex min-h-0 flex-col overflow-y-auto overscroll-contain px-1 py-1"
    >
      {renderSlot('stage')}
    </div>
  )
  const centerDock = (
    <div className="pointer-events-auto w-full space-y-2 bg-transparent">
      {renderSlot('dock')}
      {renderSlot('composer')}
    </div>
  )
  const overlayDock = (
    <div className="pointer-events-auto w-full space-y-2 bg-transparent">
      {renderSlot('dock')}
      {renderSlot('composer')}
    </div>
  )

  const overlayCollapsed = !overlayOpen || hidden
  const overlayNode =
    overlay && overlayMounted
      ? createPortal(
        <div
          className={`chat-overlay-panel${overlayCollapsed ? ' is-autohide' : ''}${threadOpen ? '' : ' is-compose-only'}`}
          data-with-sidebar={withSidebar ? '1' : '0'}
          data-testid="chat-overlay-panel"
          data-compose-only={threadOpen ? undefined : '1'}
          style={{
            ['--overlay-chat-height' as string]: `${overlayChatHeight}px`,
            ['--rail-w' as string]: railOpen ? '48px' : '0px',
          } as CSSProperties}
          onMouseEnter={keepVisible}
          onMouseLeave={hideIfIdle}
        >
          <div
            className="chat-overlay-resize"
            data-testid="chat-overlay-resize"
            title="拖动调节聊天高度"
            onPointerDown={onResizeHeight}
          />
          {header}
          <div className="chat-overlay-thread">{overlayStage}</div>
          <div className="chat-composer-dock">{overlayDock}</div>
        </div>,
        document.body,
      )
    : null

  const mountCenter = showCenter || (heldCenter && !overlayOpen)
  if (!mountCenter) return overlayNode

  return (
    <>
      <div
        className={`relative min-h-0 w-full flex-1 flex-col overflow-hidden ${showCenter ? 'flex' : 'hidden'}`}
        aria-hidden={!showCenter}
        inert={showCenter ? undefined : true}
        data-testid="agent-center"
      >
        <div className="absolute inset-0 z-1 flex min-h-0 overflow-hidden">
          <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            {centerStage}
            <div className="chat-composer-dock pointer-events-none absolute inset-x-0 bottom-0 bg-transparent px-6 pb-4 md:px-8 lg:px-10">
              {centerDock}
            </div>
          </div>
        </div>
      </div>
      {overlayNode}
    </>
  )
})

function PluginModuleStage({
  slots,
  activeId,
  renderSlot,
}: {
  slots: SlotsService
  activeId: string
  renderSlot: SlotProps['renderSlot']
}) {
  const entries = useSlotEntries(slots, 'app-modules')
  const sorted = [...entries].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  return (
    <>
      {sorted.map((entry) => {
        const extra = entry.props?.() ?? {}
        const moduleId = String(extra.moduleId ?? extra.id ?? entry.id)
        if (moduleId !== activeId) return null
        const Component = entry.Component
        return (
          <div
            key={entry.id}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            data-testid={`${moduleId}-module`}
          >
            <Component {...extra} renderSlot={renderSlot} />
          </div>
        )
      })}
    </>
  )
}

function Shell(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const useAppModules = props.useAppModules as ReturnType<typeof bindAppModules>
  const useAppModulesNavReady = props.useAppModulesNavReady as ReturnType<typeof bindAppModulesNavReady> | undefined
  const appModules = props.appModules as AppModulesService
  const sessionView = props.sessionView as SessionViewService
  const projectView = props.projectView as ProjectViewService
  const slots = props.slots as SlotsService
  const navigate = useNavigate()
  const location = useLocation()
  const modules = useAppModules()
  const navReady = useAppModulesNavReady ? useAppModulesNavReady() : true
  const pluginModules = modules.filter((item) => item.id !== 'agent')
  const railModules = navReady ? modules : []
  const sessionId = useSessionView((state) => state.sessionId)
  const danceSessions = useSessionView((state) => state.sessions)
  const dancing = useSyncExternalStore(
    subscribeMascotDance,
    () => isMascotDancing(),
    () => false,
  )
  const danceShape = useSyncExternalStore(
    subscribeMascotDance,
    () => mascotDanceShape(),
    () => 'circle' as const,
  )
  const project = useSessionView((state) => state.project)
  const focusCallId = useSessionView((state) => state.focusCallId)
  const routeView = useSessionView((state) => state.view)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<string>('plugins')
  const [configOpen, setConfigOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('cordis.sidebar.collapsed') === '1'
    } catch {
      return false
    }
  })
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const n = Number(localStorage.getItem('cordis.sidebar.width'))
      if (Number.isFinite(n) && n >= SIDEBAR_MIN && n <= SIDEBAR_MAX) return n
    } catch {
      /* ignore */
    }
    return SIDEBAR_DEFAULT
  })
  const lastWideSidebar = useRef(sidebarWidth >= SIDEBAR_LABEL_AT ? sidebarWidth : SIDEBAR_MAX)
  const persistSidebar = useCallback((width: number, collapsed: boolean) => {
    if (collapsed) {
      setSidebarCollapsed(true)
      try {
        localStorage.setItem('cordis.sidebar.collapsed', '1')
      } catch {
        /* ignore */
      }
      return
    }
    const next = clampSidebarWidth(width)
    if (next === 0) {
      setSidebarCollapsed(true)
      try {
        localStorage.setItem('cordis.sidebar.collapsed', '1')
      } catch {
        /* ignore */
      }
      return
    }
    setSidebarWidth(next)
    setSidebarCollapsed(false)
    if (next >= SIDEBAR_LABEL_AT) lastWideSidebar.current = next
    try {
      localStorage.setItem('cordis.sidebar.width', String(next))
      localStorage.setItem('cordis.sidebar.collapsed', '0')
    } catch {
      /* ignore */
    }
  }, [])
  const collapseSidebar = useCallback(() => {
    setSidebarCollapsed(true)
    try {
      localStorage.setItem('cordis.sidebar.collapsed', '1')
    } catch {
      /* ignore */
    }
  }, [])
  const expandSidebar = useCallback(
    () => persistSidebar(Math.max(SIDEBAR_LABEL_AT, lastWideSidebar.current, sidebarWidth), false),
    [persistSidebar, sidebarWidth],
  )
  const onSidebarWidthChange = useCallback(
    (width: number) => {
      const next = clampSidebarWidth(width)
      persistSidebar(next === 0 ? sidebarWidth : next, next === 0)
    },
    [persistSidebar, sidebarWidth],
  )
  const [railOpen, setRailOpen] = useState(false)
  const [railPinned, setRailPinned] = useState(() => {
    try {
      return localStorage.getItem('cordis.rail.pinned') === '1'
    } catch {
      return false
    }
  })
  const railClusterRef = useRef<HTMLDivElement>(null)
  const openRail = useCallback(() => setRailOpen(true), [])
  const closeRail = useCallback((event: { relatedTarget: EventTarget | null }) => {
    if (railPinned) return
    const next = event.relatedTarget
    if (next instanceof Node && railClusterRef.current?.contains(next)) return
    setRailOpen(false)
  }, [railPinned])
  const toggleRailPin = useCallback(() => {
    setRailPinned((prev) => {
      const next = !prev
      try {
        localStorage.setItem('cordis.rail.pinned', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      if (next) setRailOpen(true)
      return next
    })
  }, [])
  const [inspectorOpen, setInspectorOpen] = useState(() => {
    try {
      return localStorage.getItem('cordis.inspector.open') === '1'
    } catch {
      return false
    }
  })
  const [inspectorWidth, setInspectorWidth] = useState(() => {
    try {
      const n = Number(localStorage.getItem('cordis.inspector.width'))
      if (Number.isFinite(n) && n >= 240 && n <= 1000) return n
    } catch {
      /* ignore */
    }
    return 320
  })
  const overlayAutohide = useSyncExternalStore(subscribeOverlayAutohide, getOverlayAutohide, () => false)
  const overlayPinned = useSyncExternalStore(subscribeOverlayPinned, getOverlayPinned, () => false)
  const toggleInspector = useCallback(() => {
    setInspectorOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem('cordis.inspector.open', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      if (!next) requestInspectorClose()
      return next
    })
  }, [])
  const onInspectorWidthChange = useCallback((width: number) => {
    const next = Math.min(1000, Math.max(240, Math.round(width)))
    setInspectorWidth(next)
    try {
      localStorage.setItem('cordis.inspector.width', String(next))
    } catch {
      /* ignore */
    }
  }, [])
  const activeModule = moduleIdFromPath(location.pathname, pluginModules)
  useEffect(() => {
    const onWidth = (event: Event) => {
      const n = (event as CustomEvent<number>).detail
      if (typeof n === 'number' && Number.isFinite(n)) onInspectorWidthChange(n)
    }
    window.addEventListener('biu:inspector-width', onWidth)
    return () => window.removeEventListener('biu:inspector-width', onWidth)
  }, [onInspectorWidthChange])
  useEffect(() => {
    const persist = (next: boolean) => {
      setInspectorOpen(next)
      try {
        localStorage.setItem('cordis.inspector.open', next ? '1' : '0')
      } catch {
        /* ignore */
      }
    }
    const onOpen = () => persist(true)
    const onClose = () => persist(false)
    const onToggle = () => {
      setInspectorOpen((prev) => {
        const next = !prev
        try {
          localStorage.setItem('cordis.inspector.open', next ? '1' : '0')
        } catch {
          /* ignore */
        }
        if (!next) queueMicrotask(() => requestInspectorClose())
        return next
      })
    }
    window.addEventListener('biu:inspector-open', onOpen)
    window.addEventListener('biu:inspector-close', onClose)
    window.addEventListener('biu:inspector-toggle', onToggle)
    return () => {
      window.removeEventListener('biu:inspector-open', onOpen)
      window.removeEventListener('biu:inspector-close', onClose)
      window.removeEventListener('biu:inspector-toggle', onToggle)
    }
  }, [])
  const appRoute = parseAppPath(location.pathname, pluginModules)
  const inspectorVisible = inspectorOpen
  // 侧栏高亮跟 URL，不跟 store：点一下立刻亮，不等 load 完成
  const routeSessionId = appRoute.kind === 'session' ? appRoute.sessionId : null
  const agentHref = sessionId ? `/s/${sessionId}` : '/'
  const showChatSidebar = activeModule === 'agent'
  const sidebarCol = sidebarCollapsed ? 0 : sidebarWidth
  const sidebarNarrow = sidebarCol < SIDEBAR_LABEL_AT
  const sidebarShowTags = sidebarCol >= SIDEBAR_TAG_AT
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  )
  useEffect(() => {
    const sync = () => setViewportWidth(window.innerWidth)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])
  const leftPane =
    showChatSidebar ||
    appRoute.kind === 'collection-view' ||
    appRoute.kind === 'record' ||
    (appRoute.kind === 'module' && appRoute.moduleId !== 'tasks')
  const shellColumns = allocateShellColumns({
    viewportWidth,
    leftPane,
    leftWidth: leftPane ? sidebarCol : undefined,
    inspectorOpen: inspectorVisible,
    inspectorWidth,
  })
  const leftHidden = shellColumns.left <= 0
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('biu:shell-sidebar-width', { detail: sidebarCol }))
  }, [sidebarCol])
  useEffect(() => {
    const toggle = () => {
      if (sidebarCollapsed || sidebarWidth < SIDEBAR_LABEL_AT) expandSidebar()
      else collapseSidebar()
    }
    const onCollapse = () => collapseSidebar()
    const onExpand = () => expandSidebar()
    window.addEventListener('biu:toggle-shell-sidebar', toggle)
    window.addEventListener('biu:collapse-shell-sidebar', onCollapse)
    window.addEventListener('biu:expand-shell-sidebar', onExpand)
    return () => {
      window.removeEventListener('biu:toggle-shell-sidebar', toggle)
      window.removeEventListener('biu:collapse-shell-sidebar', onCollapse)
      window.removeEventListener('biu:expand-shell-sidebar', onExpand)
    }
  }, [collapseSidebar, expandSidebar, sidebarCollapsed, sidebarWidth])

  // 工具检查 /debuginspect：打开右侧轨迹 Tab（主区不再切 Debug 页）
  useEffect(() => {
    if (!focusCallId && routeView !== 'debug') return
    setInspectorOpen(true)
    try {
      localStorage.setItem('cordis.inspector.open', '1')
    } catch {
      /* ignore */
    }
  }, [focusCallId, routeView])

  // 单向：URL → sessionView。插件还没挂上时不要把 /database 当成首页。
  useEffect(() => {
    const waitingOnNav =
      !navReady && location.pathname !== '/' && !location.pathname.startsWith('/s/')
    if (waitingOnNav) return
    const route = parseAppPath(location.pathname, pluginModules)
    void sessionView.applyRoute(route).catch(() => undefined)
  }, [location.pathname, navReady, sessionView, appModules.version()])

  // /debug 兼容：主区仍聊天，轨迹在右侧；URL 收成 /s/:id
  useEffect(() => {
    const route = parseAppPath(location.pathname)
    if (route.kind !== 'session' || route.view !== 'debug') return
    navigate(`/s/${encodeURIComponent(route.sessionId)}`, { replace: true })
  }, [location.pathname, navigate])

  useEffect(() => {
    void sessionView.refreshSessions()
  }, [sessionView])

  useEffect(() => {
    void projectView.attachSession(sessionId, project)
  }, [sessionId, project, projectView])

  useEffect(() => {
    const unsub = projectView.subscribe(() => {
      const state = projectView.get()
      const current = sessionView.get()
      if (!state.sessionId || state.sessionId !== current.sessionId) return
      // attachSession 回写同内容时会再次进来；setProjectMeta 内部相等则 no-op，打断环
      sessionView.setProjectMeta(state.project)
    })
    return () => {
      unsub()
    }
  }, [projectView, sessionView])

  const chatHeader = (
    <header className="chat-view-header" data-biu-ignore>
      <div className="chat-view-header-left">
        {sidebarNarrow ? (
          <button
            type="button"
            className="chat-view-header-expand"
            title="展开左侧边栏"
            aria-label="展开左侧边栏"
            data-testid="header-sidebar-expand"
            onClick={expandSidebar}
          >
            <ChevronDoubleRightIcon {...chromeIcon} />
          </button>
        ) : null}
        {project ? (
          <div className="chat-view-project" title={project.path ?? project.name}>
            <FolderGlyph className="chat-view-project-icon" />
            <span className="chat-view-project-name">{project.name}</span>
          </div>
        ) : null}
      </div>
      <ChatSessionTitle useSessionView={useSessionView} sessionView={sessionView} />
      <div className="chat-view-header-right">
        <button
          type="button"
          className="chat-view-header-expand"
          title="配置"
          aria-label="配置"
          data-testid="header-config-toggle"
          onClick={() => setConfigOpen(true)}
        >
          <AdjustmentsHorizontalIcon {...chromeIcon} />
        </button>
        <button
          type="button"
          className={`chat-view-header-expand${inspectorOpen ? ' is-active' : ''}`}
          title={inspectorOpen ? '收起检查器' : '打开检查器'}
          aria-label={inspectorOpen ? '收起检查器' : '打开检查器'}
          aria-pressed={inspectorOpen}
          data-testid="inspector-toggle"
          onClick={toggleInspector}
        >
          {inspectorOpen ? (
            <ChevronDoubleRightIcon {...chromeIcon} />
          ) : (
            <ChevronDoubleLeftIcon {...chromeIcon} />
          )}
        </button>
      </div>
    </header>
  )

  const overlayHeader = (
    <header className="chat-view-header" data-biu-ignore>
      <div className="chat-view-header-left">
        {project ? (
          <div className="chat-view-project" title={project.path ?? project.name}>
            <FolderGlyph className="chat-view-project-icon" />
            <span className="chat-view-project-name">{project.name}</span>
          </div>
        ) : null}
      </div>
      <ChatSessionTitle useSessionView={useSessionView} sessionView={sessionView} />
      <div className="chat-view-header-right">
        <button
          type="button"
          className={`chat-view-header-expand${overlayPinned ? ' is-active' : ''}`}
          title={overlayPinned ? '取消固定聊天窗口' : '固定聊天窗口'}
          aria-label={overlayPinned ? '取消固定聊天窗口' : '固定聊天窗口'}
          aria-pressed={overlayPinned}
          data-testid="chat-overlay-pin"
          onClick={toggleOverlayPinned}
        >
          <MapPinIcon {...chromeIcon} />
        </button>
      </div>
    </header>
  )

  return (
    <div
      className={`app-shell${leftPane
          ? ` app-shell-agent${leftHidden ? ' is-sidebar-collapsed' : ''}${sidebarNarrow && !leftHidden ? ' is-sidebar-narrow' : ''}${inspectorVisible ? ' is-inspector-open' : ''}${activeModule === 'agent' && overlayAutohide ? ' is-chat-overlay-autohide' : ''
          }`
          : ` app-shell-module${inspectorVisible ? ' is-inspector-open' : ''}`
        }${railOpen || railPinned ? ' is-rail-open' : ''}${leftHidden ? ' is-left-hidden' : ''}`}
      data-testid="app-shell"
      style={
        {
          ['--sidebar-col' as string]: `${shellColumns.left}px`,
          ...(inspectorVisible
            ? { ['--inspector-width' as string]: `${shellColumns.inspector}px` }
            : {}),
        } as CSSProperties
      }
    >
      <div className="app-rail-cluster" ref={railClusterRef}>
        <div
          className="app-rail-hotzone"
          aria-hidden
          onMouseEnter={openRail}
          onMouseLeave={closeRail}
        />
        <div
          className="app-rail-hover"
          onMouseEnter={openRail}
          onMouseLeave={closeRail}
          onFocusCapture={openRail}
          onBlurCapture={(event) => closeRail(event)}
        >
          <ModuleRail
            active={activeModule}
            agentHref={agentHref}
            modules={railModules}
            pinned={railPinned}
            onTogglePin={toggleRailPin}
            onSettings={() => setSettingsOpen(true)}
          />
        </div>
      </div>

      {showChatSidebar ? (
        <ChatSidebar
          visible={!leftHidden}
          narrow={sidebarNarrow}
          showTags={sidebarShowTags}
          routeSessionId={routeSessionId}
          useSessionView={useSessionView}
          sessionView={sessionView}
          onCollapse={collapseSidebar}
          onExpand={expandSidebar}
          onWidthChange={onSidebarWidthChange}
        />
      ) : leftPane ? (
        <ShellSidebarFrame
          visible={!leftHidden}
          narrow={sidebarNarrow}
          showTags={sidebarShowTags}
          onCollapse={collapseSidebar}
          onExpand={expandSidebar}
          onWidthChange={onSidebarWidthChange}
          testId="module-sidebar"
        >
          <div
            id="shell-module-sidebar"
            className="app-side-bar-module-slot min-h-0 flex min-w-0 flex-1 flex-col overflow-hidden"
          />
        </ShellSidebarFrame>
      ) : null}

      <DanceStage sessions={danceSessions} on={dancing} shape={danceShape} />
      {activeModule === 'agent' ? null : (
        <BrandCornerMascot
          agents={danceSessions}
          activeId={sessionId}
          leading={props.renderSlot('corner-tools')}
          onSelect={(id) => {
            void sessionView.load(id, { view: 'chat' })
          }}
        />
      )}

      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div
          className={`min-h-0 min-w-0 flex-col overflow-hidden ${activeModule === 'agent' ? 'flex flex-1' : 'contents'}`}
        >
          {activeModule === 'agent' ? chatHeader : null}
          <AgentMainPanels
            renderSlot={props.renderSlot}
            header={overlayHeader}
            floating={activeModule !== 'agent'}
            showCenter={activeModule === 'agent'}
            withSidebar={leftPane && !leftHidden}
            railOpen={railOpen || railPinned}
          />
        </div>
        <PluginModuleStage
          slots={slots}
          activeId={activeModule === 'agent' ? '' : activeModule}
          renderSlot={props.renderSlot}
        />
      </main>

      <SessionInspector
        open={inspectorVisible}
        width={inspectorWidth}
        onWidthChange={onInspectorWidthChange}
        useSessionView={useSessionView}
        sessionView={sessionView}
        slots={slots}
        renderSlot={props.renderSlot}
      />

      <SessionConfigDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        useSessionView={useSessionView}
        sessionView={sessionView}
      />

      <div
        className={`fixed inset-0 z-20 flex items-center justify-center bg-(--dsw-overlay) ${settingsOpen ? '' : 'hidden'}`}
        onClick={() => setSettingsOpen(false)}
      >
        <div
          className="flex h-[min(800px,calc(100vh-48px))] w-[min(800px,calc(100vw-48px))] overflow-hidden rounded-3xl bg-(--dsw-surface) shadow-2xl"
          role="dialog"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
        >
          <nav className="w-48 shrink-0 border-r border-(--dsw-border) bg-(--dsw-sidebar) p-4">
            <div className="mb-4 flex items-center gap-2 text-(--dsw-label)">
              <span className="text-sm font-semibold">Settings</span>
            </div>
            <ul className="space-y-1 text-sm text-(--dsw-label-2)">
              {[
                { key: 'plugins', label: 'Plugins' },
                { key: 'routes', label: 'Routes' },
                { key: 'events', label: 'Events' },
              ].map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${settingsTab === item.key
                        ? 'bg-(--dsw-business-soft) text-(--dsw-business)'
                        : 'hover:bg-(--dsw-hover)'
                      }`}
                    onClick={() => setSettingsTab(item.key)}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-(--dsw-border) px-5 py-3">
              <h2 className="text-sm font-medium">{settingsTab}</h2>
              <button
                type="button"
                className="rounded-full px-2 py-1 text-sm text-(--dsw-label-3) hover:bg-(--dsw-hover)"
                onClick={() => setSettingsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
              {settingsTab === 'plugins' ? (
                <section>{props.renderSlot('sidebar')}</section>
              ) : null}
              {settingsTab === 'routes' ? (
                <section>{props.renderSlot('routes')}</section>
              ) : null}
              {settingsTab === 'events' ? (
                <section>{props.renderSlot('log')}</section>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {props.renderSlot('root-overlays')}
    </div>
  )
}

export function apply(ctx: Context) {
  const shellProps = {
    useSnapshot: bindSnapshot(ctx.snapshot as SnapshotService),
    useSessionView: bindSessionView(ctx.sessionView as SessionViewService),
    useAppModules: bindAppModules(ctx.appModules as AppModulesService),
    useAppModulesNavReady: bindAppModulesNavReady(ctx.appModules as AppModulesService),
    sessionView: ctx.sessionView as SessionViewService,
    projectView: ctx.projectView as ProjectViewService,
    useProjectView: bindProjectView(ctx.projectView as ProjectViewService),
    slots: ctx.slots as SlotsService,
    appModules: ctx.appModules as AppModulesService,
  }
  ctx.slots.fill('root', Shell, {
    children: {
      sidebar: { kind: 'single' },
      demos: { kind: 'list' },
      dock: { kind: 'list' },
      stage: { kind: 'list' },
      trajectory: { kind: 'list' },
      project: { kind: 'single' },
      composer: { kind: 'single' },
      settings: { kind: 'list' },
      log: { kind: 'single' },
      routes: { kind: 'single' },
      'app-modules': { kind: 'list' },
      'inspector-panels': { kind: 'list' },
      'header-tools': { kind: 'list' },
      'corner-tools': { kind: 'list' },
      'root-overlays': { kind: 'list' },
    },
    props: () => shellProps,
  })
}
