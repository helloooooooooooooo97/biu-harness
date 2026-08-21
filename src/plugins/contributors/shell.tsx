import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
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
import { SessionMascotMark, SidebarMascot } from './mascot/sidebar-mascot.tsx'
import {
  assignSessionMascot,
  DEFAULT_SESSION_MASCOT,
  ensureSessionMascots,
  releaseSessionMascot,
} from './mascot/session-mascot.ts'
import type { SessionMascotIdentity } from './mascot/grok-bot-types.ts'
import { LuPlus } from 'react-icons/lu'

export const name = 'shell'
export const inject = ['slots', 'snapshot', 'sessionView', 'projectView']

function ModuleIcon({ id }: { id: AppModuleId }) {
  if (id === 'workspace') {
    return (
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5h16M4 12h16M4 16.5h10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 4.5h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z" />
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
  busy,
  identity,
  onSettings,
}: {
  active: AppModuleId
  agentHref: string
  live: boolean
  busy: boolean
  identity: SessionMascotIdentity
  onSettings: () => void
}) {
  return (
    <nav className="app-activity-bar" aria-label="Activity bar">
      <Link to={agentHref} className="app-activity-brand" title="HARNESS" aria-label="Home">
        <SidebarMascot
          size={34}
          busy={busy}
          identity={identity}
          title={`${identity.shape} · ${identity.color}`}
        />
      </Link>
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

function WorkspaceModule() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-[var(--dsw-label)]">Workspace</h1>
      <p className="max-w-md text-sm leading-6 text-[var(--dsw-label-3)]">
        项目绑定在对话输入上方的文件夹图标：选目录后作为该 Session 的 cwd。无需单独大面板。
      </p>
    </div>
  )
}

function Shell(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const sessionView = props.sessionView as SessionViewService
  const projectView = props.projectView as ProjectViewService
  const navigate = useNavigate()
  const location = useLocation()
  const live = useSnapshot((state: Snapshot) => state.plugins.some((plugin) => plugin.enabled))
  const sessions = useSessionView((state) => state.sessions)
  const sessionId = useSessionView((state) => state.sessionId)
  const project = useSessionView((state) => state.project)
  const view = useSessionView((state) => state.view)
  const agentBusy = useSessionView((state) => state.agentStatus === 'running')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mascotMap, setMascotMap] = useState<Record<string, SessionMascotIdentity>>({})
  const activeModule = moduleIdFromPath(location.pathname)
  const appRoute = parseAppPath(location.pathname)
  // 侧栏高亮跟 URL，不跟 store：点一下立刻亮，不等 load 完成
  const routeSessionId = appRoute.kind === 'session' ? appRoute.sessionId : null
  const agentHref = sessionId ? `/s/${sessionId}${view === 'trajectory' ? '/trajectory' : ''}` : '/'
  const activeMascot =
    (routeSessionId && mascotMap[routeSessionId]) ||
    (sessionId && mascotMap[sessionId]) ||
    DEFAULT_SESSION_MASCOT

  // 单向：URL → sessionView。回写只靠 Link / navigate，不做 state→URL。
  useEffect(() => {
    const route = parseAppPath(location.pathname)
    void sessionView.applyRoute(route).catch(() => {
      if (location.pathname !== '/') navigate('/', { replace: true })
    })
  }, [location.pathname, navigate, sessionView])

  useEffect(() => {
    void sessionView.refreshSessions()
  }, [sessionView])

  useEffect(() => {
    setMascotMap(ensureSessionMascots(sessions.map((item) => item.id)))
  }, [sessions])

  useEffect(() => {
    void projectView.attachSession(sessionId, project)
  }, [sessionId, project, projectView])

  useEffect(() => {
    const unsub = projectView.subscribe(() => {
      const state = projectView.get()
      if (state.sessionId && state.sessionId === sessionView.get().sessionId) {
        sessionView.setProjectMeta(state.project)
      }
    })
    return () => {
      unsub()
    }
  }, [projectView, sessionView])

  return (
    <div
      className={`app-shell${activeModule === 'agent' ? ' app-shell-agent' : ' app-shell-module'}`}
    >
      <ModuleRail
        active={activeModule}
        agentHref={agentHref}
        live={live}
        busy={agentBusy}
        identity={activeMascot}
        onSettings={() => setSettingsOpen(true)}
      />

      {/* 模块切换用 hidden 保活，避免卸载重挂导致路由体感慢 */}
      <aside
        className={`app-side-bar min-h-0 flex-col overflow-hidden border-r border-[var(--dsw-border)] bg-[var(--dsw-sidebar)] ${
          activeModule === 'agent' ? 'flex' : 'hidden'
        }`}
        aria-hidden={activeModule !== 'agent'}
      >
        <div className="flex shrink-0 items-center gap-2.5 px-4 pt-4 pb-2">
          <SidebarMascot
            size={48}
            busy={agentBusy}
            identity={activeMascot}
            title={`${activeMascot.shape} · ${activeMascot.color}`}
          />
          <div className="flex items-center gap-2 text-[var(--dsw-label)]">
            <span className="text-[15px] font-semibold tracking-tight">deepseek</span>
            <span className="rounded-[6px] border border-[var(--dsw-border)] bg-[var(--dsw-hover)] px-1.5 py-[2px] text-[10px] font-semibold tracking-wider text-[var(--dsw-label-2)]">
              HARNESS
            </span>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] font-semibold tracking-wider text-[var(--dsw-label-3)] uppercase">Chat</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="grid size-6 place-items-center rounded-[6px] text-[var(--dsw-label-3)] hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-business)]"
                title="New Session"
                aria-label="New Session"
                onClick={() => {
                  void sessionView.newSession().then((id) => {
                    const identity = assignSessionMascot(id)
                    setMascotMap((prev) => ({ ...prev, [id]: identity }))
                    navigate(`/s/${id}`)
                  })
                }}
              >
                <LuPlus className="size-3.5" />
              </button>
            </div>
          </div>
          {sessions.length === 0 ? (
            <p className="px-1 text-[11px] leading-4 text-[var(--dsw-label-3)]">No chats yet. Send a message or create one.</p>
          ) : (
            sessions.map((item) => {
              const active = item.id === routeSessionId
              const identity = mascotMap[item.id] ?? DEFAULT_SESSION_MASCOT
              return (
                <div
                  key={item.id}
                  className={`group mb-1 flex w-full items-stretch rounded-[12px] ${
                    active ? 'bg-[var(--dsw-business-soft)] text-[var(--dsw-business)]' : 'hover:bg-[var(--dsw-hover)]'
                  }`}
                >
                  <Link
                    to={`/s/${item.id}${view === 'trajectory' ? '/trajectory' : ''}`}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-sm"
                  >
                    {active ? (
                      <SidebarMascot
                        size={28}
                        busy={agentBusy}
                        identity={identity}
                        title={`${identity.shape} · ${identity.color}`}
                      />
                    ) : (
                      <SessionMascotMark
                        size={28}
                        shape={identity.shape}
                        color={identity.color}
                        title={`${identity.shape} · ${identity.color}`}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <div className="truncate font-medium">{item.title}</div>
                      <div className="mt-0.5 font-mono text-[10px] opacity-70">
                        {item.id.slice(0, 8)} · {item.eventCount} events
                        {item.project ? ` · ${item.project.name}` : ''}
                      </div>
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="shrink-0 px-2 text-[var(--dsw-label-3)] opacity-0 transition-opacity hover:text-[var(--dsw-danger)] group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Delete session ${item.title}`}
                    title="Delete"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      if (!window.confirm(`Delete session “${item.title}”?`)) return
                      const wasActive = item.id === sessionId
                      releaseSessionMascot(item.id)
                      setMascotMap((prev) => {
                        const next = { ...prev }
                        delete next[item.id]
                        return next
                      })
                      void sessionView.deleteSession(item.id).then(() => {
                        if (!wasActive) return
                        const next = sessionView.get().sessionId
                        navigate(next ? `/s/${next}` : '/')
                      })
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M10 7V5h4v2m-6 3v8m4-8v8m-7-11 1 14h10l1-14" />
                    </svg>
                  </button>
                </div>
              )
            })
          )}
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div
          className={`min-h-0 min-w-0 flex-col overflow-hidden ${activeModule === 'agent' ? 'flex flex-1' : 'hidden'}`}
          aria-hidden={activeModule !== 'agent'}
        >
          <header className="flex h-12 shrink-0 items-center gap-4 border-b border-[var(--dsw-border)] px-6">
            <NavLink
              to={sessionId ? `/s/${sessionId}` : '/'}
              end
              className={({ isActive }) =>
                `relative pb-3 pt-3 text-[13px] font-medium ${isActive ? 'text-[var(--dsw-business)]' : 'text-[var(--dsw-label-3)]'}`
              }
            >
              {({ isActive }) => (
                <>
                  Chat
                  {isActive ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--dsw-business)]" /> : null}
                </>
              )}
            </NavLink>
            <NavLink
              to={sessionId ? `/s/${sessionId}/trajectory` : '/'}
              className={({ isActive }) =>
                `relative pb-3 pt-3 text-[13px] font-medium ${isActive ? 'text-[var(--dsw-business)]' : 'text-[var(--dsw-label-3)]'}`
              }
            >
              {({ isActive }) => (
                <>
                  Trajectory
                  {isActive ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--dsw-business)]" /> : null}
                </>
              )}
            </NavLink>
          </header>
          <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            {/*
              不用 display:none：大 Markdown DOM 被隐藏后再显示会重算布局（数百 ms longtask）。
              absolute + visibility 保活布局，Chat↔Trajectory 只切可见性。
            */}
            <div
              className={`absolute inset-0 min-h-0 overflow-hidden ${
                view === 'chat' ? 'z-[1] flex' : 'pointer-events-none invisible z-0 flex'
              }`}
              aria-hidden={view !== 'chat'}
            >
              <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 pb-44 md:px-6">
                  {props.renderSlot('stage')}
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-transparent px-4 pb-4 md:px-6">
                  <div className="pointer-events-auto space-y-2 bg-transparent">
                    {props.renderSlot('dock')}
                    {props.renderSlot('composer')}
                  </div>
                </div>
              </div>
            </div>
            <div
              className={`absolute inset-0 min-h-0 overflow-hidden ${
                view === 'trajectory' ? 'z-[1] flex flex-col' : 'pointer-events-none invisible z-0 flex flex-col'
              }`}
              aria-hidden={view !== 'trajectory'}
            >
              {props.renderSlot('trajectory')}
            </div>
          </div>
        </div>
        <div
          className={activeModule === 'workspace' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
          aria-hidden={activeModule !== 'workspace'}
        >
          <WorkspaceModule />
        </div>
      </main>

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
