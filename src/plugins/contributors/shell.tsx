import { memo, useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'
import { bindSnapshot, type Snapshot, type SnapshotService } from '../infrastructure/snapshot.ts'
import { bindSessionView, type SessionViewService } from '../infrastructure/session-view.ts'
import { bindProjectView, type ProjectViewService } from '../infrastructure/project-view.ts'
import { parseAppPath } from '../infrastructure/session-route.ts'
import {
  APP_MODULES,
  moduleIdFromPath,
  type AppModuleId,
} from '../infrastructure/app-modules.ts'
import { FishLogo } from './brand.tsx'
import { ChatSidebar } from './chat-sidebar.tsx'
import { SessionInspector } from './session-inspector.tsx'
import { FolderGlyph } from './chat/project-panel.tsx'
import { DashboardModule } from './dashboard-module.tsx'
import {
  LuPanelLeft,
  LuPanelRight,
} from 'react-icons/lu'

export const name = 'shell'
export const inject = ['slots', 'snapshot', 'sessionView', 'projectView']

function ModuleIcon({ id }: { id: AppModuleId }) {
  if (id === 'dashboard') {
    return (
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4.5h7v7H4zM13 4.5h7v4h-7zM13 11.5h7v8h-7zM4 14.5h7v5H4z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 9h8M8 13h5M7 5h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3.5L9 19v-3H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
      />
    </svg>
  )
}

function ModuleRail({
  active,
  agentHref,
  live,
  onSettings,
}: {
  active: AppModuleId
  agentHref: string
  live: boolean
  onSettings: () => void
}) {
  return (
    <nav className="app-activity-bar" aria-label="Activity bar">
      <div className="app-activity-list">
        {APP_MODULES.map((module) => {
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
              <ModuleIcon id={module.id} />
              <span className="sr-only">{module.label}</span>
            </Link>
          )
        })}
      </div>
      <div className="app-activity-footer">
        <span
          className={`app-activity-live${live ? ' is-live' : ''}`}
          title={live ? 'Live' : 'Connecting'}
          aria-label={live ? 'Live' : 'Connecting'}
        />
        <button
          type="button"
          className="app-activity-item app-activity-settings"
          title="Settings"
          aria-label="Settings"
          onClick={onSettings}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.3 3.2a1.8 1.8 0 0 1 3.4 0l.2 1a1.8 1.8 0 0 0 2.5 1.1l.9-.5a1.8 1.8 0 0 1 2.5 2.5l-.5.9a1.8 1.8 0 0 0 1.1 2.5l1 .2a1.8 1.8 0 0 1 0 3.4l-1 .2a1.8 1.8 0 0 0-1.1 2.5l.5.9a1.8 1.8 0 0 1-2.5 2.5l-.9-.5a1.8 1.8 0 0 0-2.5 1.1l-.2 1a1.8 1.8 0 0 1-3.4 0l-.2-1a1.8 1.8 0 0 0-2.5-1.1l-.9.5a1.8 1.8 0 0 1-2.5-2.5l.5-.9a1.8 1.8 0 0 0-1.1-2.5l-1-.2a1.8 1.8 0 0 1 0-3.4l1-.2a1.8 1.8 0 0 0 1.1-2.5l-.5-.9a1.8 1.8 0 0 1 2.5-2.5l.9.5a1.8 1.8 0 0 0 2.5-1.1z"
            />
            <circle cx="12" cy="12" r="2.4" />
          </svg>
        </button>
      </div>
    </nav>
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
      <div className="absolute inset-0 z-[1] flex min-h-0 overflow-hidden">
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          <div className="chat-stage flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 py-4 pb-44 md:px-8 lg:px-10">
            {renderSlot('stage')}
          </div>
          <div className="chat-composer-dock pointer-events-none absolute inset-x-0 bottom-0 bg-transparent px-6 pb-4 md:px-8 lg:px-10">
            <div className="pointer-events-auto space-y-2 bg-transparent">
              {renderSlot('dock')}
              {renderSlot('composer')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

function Shell(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const sessionView = props.sessionView as SessionViewService
  const projectView = props.projectView as ProjectViewService
  const navigate = useNavigate()
  const location = useLocation()
  const live = useSnapshot((state: Snapshot) => state.plugins.some((plugin) => plugin.enabled))
  const sessionId = useSessionView((state) => state.sessionId)
  const project = useSessionView((state) => state.project)
  const focusCallId = useSessionView((state) => state.focusCallId)
  const routeView = useSessionView((state) => state.view)
  const [settingsOpen, setSettingsOpen] = useState(false)
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
      if (Number.isFinite(n) && n >= 240 && n <= 720) return n
    } catch {
      /* ignore */
    }
    return 320
  })
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
  const closeInspector = useCallback(() => {
    setInspectorOpen(false)
    try {
      localStorage.setItem('cordis.inspector.open', '0')
    } catch {
      /* ignore */
    }
  }, [])
  const onInspectorWidthChange = useCallback((width: number) => {
    const next = Math.min(720, Math.max(240, Math.round(width)))
    setInspectorWidth(next)
    try {
      localStorage.setItem('cordis.inspector.width', String(next))
    } catch {
      /* ignore */
    }
  }, [])
  const activeModule = moduleIdFromPath(location.pathname)
  const appRoute = parseAppPath(location.pathname)
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
    const route = parseAppPath(location.pathname)
    void sessionView.applyRoute(route).catch(() => {
      if (location.pathname !== '/') navigate('/', { replace: true })
    })
  }, [location.pathname, navigate, sessionView])

  // /debug 兼容：主区仍聊天，轨迹在右侧；URL 收成 /s/:id
  useEffect(() => {
    const route = parseAppPath(location.pathname)
    if (route.kind !== 'session' || route.view !== 'debug') return
    navigate(`/s/${encodeURIComponent(route.sessionId)}`, { replace: true })
  }, [location.pathname, navigate])

  // 旧 /workspace 入口：活动栏已去掉，URL 收成 /
  useEffect(() => {
    const path = location.pathname.replace(/\/+$/, '') || '/'
    if (path !== '/workspace') return
    navigate('/', { replace: true })
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
      className={`app-shell${
        activeModule === 'agent'
          ? ` app-shell-agent${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}${
              inspectorOpen ? ' is-inspector-open' : ''
            }`
          : ' app-shell-module'
      }`}
      style={
        inspectorOpen
          ? ({ ['--inspector-width' as string]: `${inspectorWidth}px` } as CSSProperties)
          : undefined
      }
    >
      <ModuleRail
        active={activeModule}
        agentHref={agentHref}
        live={live}
        onSettings={() => setSettingsOpen(true)}
      />

      <ChatSidebar
        visible={showChatSidebar}
        routeSessionId={routeSessionId}
        useSessionView={useSessionView}
        sessionView={sessionView}
        onCollapse={collapseSidebar}
      />

      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div
          className={`min-h-0 min-w-0 flex-col overflow-hidden ${activeModule === 'agent' ? 'flex flex-1' : 'hidden'}`}
          aria-hidden={activeModule !== 'agent'}
        >
          <header className="chat-view-header">
            <div className="chat-view-header-left">
              {sidebarCollapsed ? (
                <button
                  type="button"
                  className="chat-view-header-expand"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                  onClick={expandSidebar}
                >
                  <LuPanelLeft className="size-3.5" />
                </button>
              ) : null}
              {project ? (
                <div className="chat-view-project" title={project.path ?? project.name}>
                  <FolderGlyph className="chat-view-project-icon" />
                  <span className="chat-view-project-name">{project.name}</span>
                </div>
              ) : null}
            </div>
            <div className="chat-view-header-right">
              <button
                type="button"
                className={`chat-view-header-expand${inspectorOpen ? ' is-active' : ''}`}
                title={inspectorOpen ? '收起检查器' : '打开检查器'}
                aria-label={inspectorOpen ? '收起检查器' : '打开检查器'}
                aria-pressed={inspectorOpen}
                data-testid="inspector-toggle"
                onClick={toggleInspector}
              >
                <LuPanelRight className="size-3.5" />
              </button>
            </div>
          </header>
          <AgentMainPanels renderSlot={props.renderSlot} />
        </div>
        <div
          className={activeModule === 'dashboard' ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden'}
          aria-hidden={activeModule !== 'dashboard'}
        >
          <DashboardModule />
        </div>
      </main>

      {activeModule === 'agent' ? (
        <SessionInspector
          open={inspectorOpen}
          width={inspectorWidth}
          onWidthChange={onInspectorWidthChange}
          onClose={closeInspector}
          useSessionView={useSessionView}
          sessionView={sessionView}
        />
      ) : null}

      <div
        className={`fixed inset-0 z-20 flex items-center justify-center bg-[var(--dsw-overlay)] ${settingsOpen ? '' : 'hidden'}`}
        onClick={() => setSettingsOpen(false)}
      >
        <div
          className="flex h-[min(800px,calc(100vh-48px))] w-[min(800px,calc(100vw-48px))] overflow-hidden rounded-[24px] bg-[var(--dsw-surface)] shadow-2xl"
          role="dialog"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
        >
          <nav className="w-48 shrink-0 border-r border-[var(--dsw-border)] bg-[var(--dsw-sidebar)] p-4">
            <div className="mb-4 flex items-center gap-2 text-[var(--dsw-label)]">
              <FishLogo size={18} />
              <span className="text-sm font-semibold">Settings</span>
            </div>
            <ul className="space-y-1 text-sm text-[var(--dsw-label-2)]">
              <li className="rounded-[8px] bg-[var(--dsw-business-soft)] px-3 py-2 text-[var(--dsw-business)]">Plugins</li>
              <li className="px-3 py-2">Assistant</li>
              <li className="px-3 py-2">Demos</li>
              <li className="px-3 py-2">Developer</li>
            </ul>
          </nav>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-[var(--dsw-border)] px-5 py-3">
              <h2 className="text-sm font-medium">Plugins & demos</h2>
              <button
                type="button"
                className="rounded-full px-2 py-1 text-sm text-[var(--dsw-label-3)] hover:bg-[var(--dsw-hover)]"
                onClick={() => setSettingsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
              <section>
                <h3 className="mb-3 text-xs font-semibold tracking-widest text-[var(--dsw-label-3)] uppercase">Plugins</h3>
                {props.renderSlot('sidebar')}
              </section>
              <section>
                <h3 className="mb-3 text-xs font-semibold tracking-widest text-[var(--dsw-label-3)] uppercase">Assistant</h3>
                {props.renderSlot('settings')}
              </section>
              <section>
                <h3 className="mb-3 text-xs font-semibold tracking-widest text-[var(--dsw-label-3)] uppercase">Demos</h3>
                <div className="space-y-3">{props.renderSlot('demos')}</div>
              </section>
              <section>
                <h3 className="mb-3 text-xs font-semibold tracking-widest text-[var(--dsw-label-3)] uppercase">Routes</h3>
                {props.renderSlot('routes')}
              </section>
              <section>
                <h3 className="mb-3 text-xs font-semibold tracking-widest text-[var(--dsw-label-3)] uppercase">Events</h3>
                {props.renderSlot('log')}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function apply(ctx: Context) {
  const shellProps = {
    useSnapshot: bindSnapshot(ctx.snapshot as SnapshotService),
    useSessionView: bindSessionView(ctx.sessionView as SessionViewService),
    sessionView: ctx.sessionView as SessionViewService,
    projectView: ctx.projectView as ProjectViewService,
    useProjectView: bindProjectView(ctx.projectView as ProjectViewService),
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
    },
    props: () => shellProps,
  })
}
