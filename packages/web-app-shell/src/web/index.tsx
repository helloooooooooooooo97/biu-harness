import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  getChatOverlay,
  subscribeChatOverlay,
  setChatOverlay,
  closeChatOverlay,
  requestOverlayFocus,
  requestInspectorClose,
  allocateShellColumns,
  clampSidebarWidth,
  isChatPagePath,
  SIDEBAR_DEFAULT,
  SIDEBAR_LABEL_AT,
  SIDEBAR_TAG_AT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
} from './chat-overlay.ts'
import { useLocation, useNavigate } from 'react-router-dom'
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
} from '@biu/public-mascot'
import {
  bindAppModules,
  bindAppModulesNavReady,
  moduleIdFromPath,
  type AppModulesService,
} from '@biu/web-app-modules'
import { ChatSidebar } from './chat-sidebar.tsx'
import { ShellSidebarFrame } from './shell-sidebar-frame.tsx'
import { ChatSessionTitle } from './chat-session-title.tsx'
import { BrandCornerMascot, DanceStage } from '@biu/public-mascot'
import type { DockService } from '@biu/core-dock'
import { SessionInspector } from './session-inspector.tsx'
import { SessionConfigDialog } from '@biu/web-session-view/dialog'
import { FolderGlyph } from '@biu/web-session-view/folder-glyph'
import { OverlayChatWindow } from './overlay-window.tsx'
import { ShellDockNav } from './shell-dock-nav.tsx'
import { ShellSettingsUpdate } from './shell-chrome.tsx'
import { ShellSearchPanel } from './shell-search.tsx'
import { useSlotEntries } from '@biu/web-slots'
import type { SlotsService } from '@biu/web-slots'
import { chromeIcon } from './chrome-icon.ts'
import { ChatDockStack, ChatStage } from '@biu/public-ui'
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
} from '@heroicons/react/16/solid'

export const name = 'shell'
export const inject = ['slots', 'dock', 'snapshot', 'sessionView', 'projectView', 'appModules']

function DockSessionMascot({
  useSessionView,
}: {
  useSessionView: ReturnType<typeof bindSessionView>
}) {
  const location = useLocation()
  const agents = useSessionView((state) => state.sessions)
  const activeId = useSessionView((state) => state.sessionId)
  const overlayOpen = useSyncExternalStore(subscribeChatOverlay, getChatOverlay, () => false)
  const onChatPage = isChatPagePath(location.pathname)
  return (
    <BrandCornerMascot
      agents={agents}
      activeId={activeId}
      open={onChatPage ? false : overlayOpen}
      onToggle={() => {
        if (getChatOverlay()) {
          closeChatOverlay()
          return
        }
        if (isChatPagePath(location.pathname)) return
        setChatOverlay(true)
        requestOverlayFocus()
      }}
    />
  )
}

function ShellDockPins({
  useSessionView,
}: {
  useSessionView: ReturnType<typeof bindSessionView>
}) {
  return <DockSessionMascot useSessionView={useSessionView} />
}

/** 主区固定聊天；轨迹改在右侧检查器。悬浮形态可挂到任意页面最顶层。 */
const AgentMainPanels = memo(function AgentMainPanels({
  renderSlot,
  header,
  showCenter,
}: {
  renderSlot: SlotProps['renderSlot']
  header: ReactNode | ((layoutTools: ReactNode) => ReactNode)
  showCenter: boolean
}) {
  const overlayOpen = useSyncExternalStore(subscribeChatOverlay, getChatOverlay, () => false)
  const [overlayMounted, setOverlayMounted] = useState(false)
  const [heldCenter, setHeldCenter] = useState(showCenter)
  if (showCenter && !heldCenter) setHeldCenter(true)
  useEffect(() => {
    setOverlayMounted(true)
  }, [])
  const stageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!overlayOpen) return
    const el = stageRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [overlayOpen])

  const centerStage = (
    <ChatStage variant="center">{renderSlot('stage')}</ChatStage>
  )
  const overlayStage = (
    <ChatStage variant="pane" stageRef={stageRef}>
      {renderSlot('stage')}
    </ChatStage>
  )
  const centerDock = (
    <ChatDockStack>
      {renderSlot('dock')}
      {renderSlot('composer')}
    </ChatDockStack>
  )
  const overlayDock = (
    <ChatDockStack>
      {renderSlot('dock')}
      {renderSlot('composer')}
    </ChatDockStack>
  )

  const overlayNode =
    overlayMounted && overlayOpen && !showCenter
      ? createPortal(
        <OverlayChatWindow
          header={header}
          thread={overlayStage}
          dock={overlayDock}
        />,
        document.body,
      )
      : null

  const mountCenter = (showCenter || heldCenter) && !overlayOpen
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
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {centerStage}
            <div className="chat-composer-dock pointer-events-none absolute inset-x-0 bottom-0 bg-transparent px-[100px] pb-[calc(1rem+25px)]">
              {centerDock}
            </div>
            {renderSlot('stage-aside')}
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
        const active = moduleId === activeId
        const Component = entry.Component
        return (
          <div
            key={entry.id}
            className={`app-stage-pane${active ? ' is-active' : ''}`}
            data-testid={`${moduleId}-module`}
            aria-hidden={!active}
            inert={!active || undefined}
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
  const dock = props.dock as DockService
  const navigate = useNavigate()
  const location = useLocation()
  const modules = useAppModules()
  const navReady = useAppModulesNavReady ? useAppModulesNavReady() : true
  const pluginModules = modules.filter((item) => item.id !== 'agent')
  const sessionId = useSessionView((state) => state.sessionId)
  const collections = useSnapshot((state) => state.collections)
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
  const project = useSessionView((state) => {
    if (state.project?.name) return state.project
    const id = state.sessionId
    if (!id) return undefined
    return state.sessions.find((item) => item.id === id)?.project
  })
  const focusCallId = useSessionView((state) => state.focusCallId)
  const routeView = useSessionView((state) => state.view)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
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
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const [searchFocusSeq, setSearchFocusSeq] = useState(0)
  const openSearch = useCallback(() => {
    setSearchOpen(true)
    setSearchFocusSeq((seq) => seq + 1)
  }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing) return
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      if (event.key !== 'f' && event.key !== 'F') return
      event.preventDefault()
      event.stopPropagation()
      openSearch()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [openSearch])
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
  const [columnResizing, setColumnResizing] = useState(false)
  const [windowResizing, setWindowResizing] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest('.sidebar-resize, .inspector-resize')) return
      setColumnResizing(true)
    }
    const onUp = () => setColumnResizing(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])
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
  const sidebarNarrow = sidebarWidth < SIDEBAR_LABEL_AT
  const sidebarShowTags = sidebarWidth >= SIDEBAR_TAG_AT
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  )
  useEffect(() => {
    let timer = 0
    const sync = () => {
      shellRef.current?.classList.add('is-window-resizing')
      setViewportWidth(window.innerWidth)
      setWindowResizing(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        shellRef.current?.classList.remove('is-window-resizing')
        setWindowResizing(false)
      }, 160)
    }
    sync()
    window.addEventListener('resize', sync)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', sync)
    }
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

  useEffect(() => {
    if (activeModule === 'agent' && getChatOverlay()) closeChatOverlay()
  }, [activeModule])

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

  const overlayHeader = (layoutTools: ReactNode) => (
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
        {layoutTools}
        <button
          type="button"
          className="chat-view-header-expand"
          title="关闭聊天窗口"
          aria-label="关闭聊天窗口"
          data-testid="chat-overlay-close"
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            closeChatOverlay()
          }}
        >
          <XMarkIcon {...chromeIcon} />
        </button>
      </div>
    </header>
  )

  return (
    <div
      ref={shellRef}
      className={`app-shell${leftPane
          ? ` app-shell-agent${leftHidden ? ' is-sidebar-collapsed' : ''}${sidebarNarrow && !leftHidden ? ' is-sidebar-narrow' : ''}${inspectorVisible ? ' is-inspector-open' : ''
          }${columnResizing ? ' is-resizing' : ''}${windowResizing ? ' is-window-resizing' : ''}`
          : ` app-shell-module${inspectorVisible ? ' is-inspector-open' : ''}${columnResizing ? ' is-resizing' : ''}${windowResizing ? ' is-window-resizing' : ''}`
        }${leftHidden ? ' is-left-hidden' : ''}`}
      data-testid="app-shell"
      style={
        {
          ['--sidebar-col' as string]: `${shellColumns.left}px`,
          ['--sidebar-flyout-width' as string]: `${Math.max(SIDEBAR_MIN, sidebarWidth)}px`,
          ['--inspector-width' as string]: `${shellColumns.inspector}px`,
        } as CSSProperties
      }
    >
      {leftPane ? (
        <ShellSidebarFrame
          visible={!leftHidden}
          narrow={sidebarNarrow}
          showTags={sidebarShowTags}
          onCollapse={collapseSidebar}
          onExpand={expandSidebar}
          onWidthChange={onSidebarWidthChange}
          testId={showChatSidebar ? 'chat-sidebar' : 'module-sidebar'}
          activeId={activeModule}
          agentHref={agentHref}
          onSettings={openSettings}
          onSearch={openSearch}
          searchOpen={searchOpen}
        >
          <div className="app-stage">
            <div
              className={`app-stage-pane${showChatSidebar ? ' is-active' : ''}`}
              aria-hidden={!showChatSidebar}
              inert={!showChatSidebar || undefined}
            >
              <ChatSidebar
                embedded
                visible
                narrow={sidebarNarrow}
                showTags={sidebarShowTags}
                routeSessionId={routeSessionId}
                useSessionView={useSessionView}
                sessionView={sessionView}
              />
            </div>
            <div
              id="shell-module-sidebar"
              className={`app-stage-pane app-side-bar-module-slot min-h-0 flex min-w-0 flex-1 flex-col overflow-hidden${showChatSidebar ? '' : ' is-active'}`}
              data-testid="module-sidebar"
              aria-hidden={showChatSidebar}
              inert={showChatSidebar || undefined}
            />
          </div>
        </ShellSidebarFrame>
      ) : null}

      <DanceStage sessions={danceSessions} on={dancing} shape={danceShape} />
      <ShellDockPins useSessionView={useSessionView} />
      <ShellDockNav
        dock={dock}
        activeId={activeModule}
        inspectorOpen={inspectorVisible}
        sessionId={sessionId}
        collections={collections}
      />

      <main className="app-stage">
        <div
          className={`app-stage-pane${activeModule === 'agent' ? ' is-active' : ''}`}
          aria-hidden={activeModule !== 'agent'}
          inert={activeModule !== 'agent' || undefined}
        >
          {chatHeader}
          <AgentMainPanels
            renderSlot={props.renderSlot}
            header={overlayHeader}
            showCenter={activeModule === 'agent'}
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
        collections={collections}
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
                { key: 'update', label: '更新' },
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
              {settingsTab === 'update' ? <ShellSettingsUpdate /> : null}
            </div>
          </div>
        </div>
      </div>
      {searchOpen
        ? createPortal(
          <ShellSearchPanel
            sessions={danceSessions.map((item) => ({ id: item.id, title: item.title }))}
            onClose={() => setSearchOpen(false)}
            focusSeq={searchFocusSeq}
          />,
          document.body,
        )
        : null}
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
    dock: ctx.dock as DockService,
    appModules: ctx.appModules as AppModulesService,
  }
  ctx.slots.fill('root', Shell, {
    children: {
      sidebar: { kind: 'single' },
      demos: { kind: 'list' },
      dock: { kind: 'list' },
      stage: { kind: 'list' },
      'stage-aside': { kind: 'single' },
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
