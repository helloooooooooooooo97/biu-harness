import { memo, useCallback, useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { chatColumnWidth, setChatOverlay, subscribeChatOverlay, getChatOverlay, CHAT_OVERLAY_ENTER } from './chat-overlay.ts'
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
  moduleIdFromPath,
  type AppModule,
  type AppModulesService,
} from '@biu/web-app-modules'
import { ChatSidebar } from './chat-sidebar.tsx'
import { ChatSessionTitle } from './chat-session-title.tsx'
import { DanceStage } from '@biu/web-mascot'
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
  onSettings,
}: {
  active: string
  agentHref: string
  modules: AppModule[]
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
            >
              <span className="app-activity-indicator" aria-hidden />
              <ModuleIcon module={module} />
              <span className="sr-only">{module.label}</span>
            </Link>
          )
        })}
      </div>
      <div className="app-activity-footer">
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

  const download = useCallback(async () => {
    if (busy) return
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
  }, [busy])

  const label = hint ?? (behind > 0 ? `下载更新 · 落后 ${behind}` : '下载更新')
  const badge = behind > 99 ? '99+' : String(behind)

  return (
    <button
      type="button"
      className={`app-activity-item app-activity-update${busy ? ' is-busy' : ''}`}
      title={label}
      aria-label={label}
      disabled={busy}
      onClick={() => void download()}
    >
      <ArrowDownTrayIcon {...chromeIcon} />
      {behind > 0 && !busy ? (
        <span className="app-activity-badge" aria-hidden>
          {badge}
        </span>
      ) : null}
    </button>
  )
}

/** 主区固定聊天；轨迹改在右侧检查器。 */
const AgentMainPanels = memo(function AgentMainPanels({
  renderSlot,
}: {
  renderSlot: SlotProps['renderSlot']
}) {
  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="absolute inset-0 z-1 flex min-h-0 overflow-hidden">
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          <div className="chat-stage flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 py-3 pb-44 md:px-8 lg:px-10">
            {renderSlot('stage')}
          </div>
          <div className="chat-composer-dock pointer-events-none absolute inset-x-0 bottom-0 bg-transparent px-6 pb-4 md:px-8 lg:px-10">
            <div className="pointer-events-auto w-full space-y-2 bg-transparent">
              {renderSlot('dock')}
              {renderSlot('composer')}
            </div>
          </div>
        </div>
      </div>
    </div>
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
        const show = moduleId === activeId
        const Component = entry.Component
        return (
          <div
            key={entry.id}
            className={show ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden' : 'hidden'}
            aria-hidden={!show}
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
  const appModules = props.appModules as AppModulesService
  const sessionView = props.sessionView as SessionViewService
  const projectView = props.projectView as ProjectViewService
  const slots = props.slots as SlotsService
  const navigate = useNavigate()
  const location = useLocation()
  const modules = useAppModules()
  const pluginModules = modules.filter((item) => item.id !== 'agent')
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
  const chatOverlay = useSyncExternalStore(subscribeChatOverlay, getChatOverlay, () => false)
  const toggleInspector = useCallback(() => {
    setInspectorOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem('cordis.inspector.open', next ? '1' : '0')
      } catch {
        /* ignore */
      }
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
  const syncChatOverlay = useCallback(() => {
    if (!inspectorOpen) {
      setChatOverlay(false)
      return
    }
    const width = chatColumnWidth({
      viewportWidth: window.innerWidth,
      inspectorOpen,
      inspectorWidth,
      sidebarCollapsed,
    })
    if (width < CHAT_OVERLAY_ENTER) setChatOverlay(true)
  }, [inspectorOpen, inspectorWidth, sidebarCollapsed])
  useEffect(() => {
    syncChatOverlay()
    window.addEventListener('resize', syncChatOverlay)
    return () => window.removeEventListener('resize', syncChatOverlay)
  }, [syncChatOverlay])
  useEffect(() => {
    const onWidth = (event: Event) => {
      const n = (event as CustomEvent<number>).detail
      if (typeof n === 'number' && Number.isFinite(n)) onInspectorWidthChange(n)
    }
    window.addEventListener('biu:inspector-width', onWidth)
    return () => window.removeEventListener('biu:inspector-width', onWidth)
  }, [onInspectorWidthChange])
  const activeModule = moduleIdFromPath(location.pathname, pluginModules)
  const appRoute = parseAppPath(location.pathname, pluginModules)
  // 侧栏高亮跟 URL，不跟 store：点一下立刻亮，不等 load 完成
  const routeSessionId = appRoute.kind === 'session' ? appRoute.sessionId : null
  const agentHref = sessionId ? `/s/${sessionId}` : '/'
  const showChatSidebar = activeModule === 'agent' && !sidebarCollapsed
  const collapseSidebar = useCallback(() => setSidebarCollapsed(true), [])
  const expandSidebar = useCallback(() => setSidebarCollapsed(false), [])

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

  // 单向：URL → sessionView。回写只靠 Link / navigate，不做 state→URL。
  useEffect(() => {
    const route = parseAppPath(location.pathname, pluginModules)
    void sessionView.applyRoute(route).catch(() => {
      if (location.pathname !== '/') navigate('/', { replace: true })
    })
  }, [location.pathname, navigate, sessionView, appModules.version()])

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

  return (
    <div
      className={`app-shell${activeModule === 'agent'
          ? ` app-shell-agent${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}${inspectorOpen ? ' is-inspector-open' : ''}${chatOverlay ? ' is-chat-overlay' : ''
          }`
          : ' app-shell-module'
        }`}
      data-testid={chatOverlay ? 'chat-overlay' : undefined}
      style={
        inspectorOpen
          ? ({ ['--inspector-width' as string]: `${inspectorWidth}px` } as CSSProperties)
          : undefined
      }
    >
      <ModuleRail
        active={activeModule}
        agentHref={agentHref}
        modules={modules}
        onSettings={() => setSettingsOpen(true)}
      />

      <ChatSidebar
        visible={showChatSidebar}
        routeSessionId={routeSessionId}
        useSessionView={useSessionView}
        sessionView={sessionView}
        onCollapse={collapseSidebar}
      />

      <DanceStage sessions={danceSessions} on={dancing} shape={danceShape} />

      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div
          className={`min-h-0 min-w-0 flex-col overflow-hidden ${activeModule === 'agent' ? 'flex flex-1' : 'hidden'}`}
          aria-hidden={activeModule !== 'agent'}
        >
          <header className="chat-view-header" data-biu-ignore>
            <div className="chat-view-header-left">
              {sidebarCollapsed ? (
                <button
                  type="button"
                  className="chat-view-header-expand"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
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
          <AgentMainPanels renderSlot={props.renderSlot} />
        </div>
        <PluginModuleStage
          slots={slots}
          activeId={activeModule === 'agent' ? '' : activeModule}
          renderSlot={props.renderSlot}
        />
      </main>

      {activeModule === 'agent' ? (
        <SessionInspector
          open={inspectorOpen}
          width={inspectorWidth}
          onWidthChange={onInspectorWidthChange}
          useSessionView={useSessionView}
          sessionView={sessionView}
          slots={slots}
          renderSlot={props.renderSlot}
        />
      ) : null}

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
      'root-overlays': { kind: 'list' },
    },
    props: () => shellProps,
  })
}
