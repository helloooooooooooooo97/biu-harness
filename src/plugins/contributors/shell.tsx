import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'
import { bindSnapshot, type Snapshot, type SnapshotService } from '../infrastructure/snapshot.ts'
import { bindSessionView, type SessionViewService } from '../infrastructure/session-view.ts'
import { parseAppPath } from '../infrastructure/session-route.ts'
import { BrandWordmark, FishLogo } from './brand.tsx'

export const name = 'shell'
export const inject = ['slots', 'snapshot', 'sessionView']

function Shell(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const sessionView = props.sessionView as SessionViewService
  const navigate = useNavigate()
  const location = useLocation()
  const snap = useSnapshot((state: Snapshot) => state)
  const live = snap.plugins.some((plugin) => plugin.enabled)
  const sessions = useSessionView((state) => state.sessions)
  const sessionId = useSessionView((state) => state.sessionId)
  const view = useSessionView((state) => state.view)
  const [settingsOpen, setSettingsOpen] = useState(false)

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

  return (
    <div className="grid h-screen grid-cols-[280px_minmax(0,1fr)] overflow-hidden bg-[var(--dsw-bg)] text-[var(--dsw-label)]">
      <aside className="flex min-h-0 flex-col overflow-hidden border-r border-[var(--dsw-border)] bg-[var(--dsw-sidebar)]">
        <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-3">
          <BrandWordmark />
        </div>
        <div className="shrink-0 px-3 pb-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-[var(--dsw-border)] bg-white px-3 py-2 text-sm font-medium hover:bg-[var(--dsw-business-soft)]"
            onClick={() => {
              void sessionView.newSession().then((id) => navigate(`/s/${id}`))
            }}
          >
            <span className="text-lg leading-none">+</span>
            New Session
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold tracking-wider text-[var(--dsw-label-3)] uppercase">Sessions</span>
            {sessionId ? (
              <button
                type="button"
                className="text-[11px] text-[var(--dsw-business)] hover:underline"
                onClick={() => {
                  void sessionView.forkCurrent().then((id) => navigate(`/s/${id}`))
                }}
              >
                Fork
              </button>
            ) : null}
          </div>
          {sessions.length === 0 ? (
            <p className="px-1 text-[11px] leading-4 text-[var(--dsw-label-3)]">No sessions yet. Send a message or create one.</p>
          ) : (
            sessions.map((item) => {
              const active = item.id === sessionId
              return (
                <div
                  key={item.id}
                  className={`group mb-1 flex w-full items-stretch rounded-[12px] ${
                    active ? 'bg-[var(--dsw-business-soft)] text-[var(--dsw-business)]' : 'hover:bg-black/[0.03]'
                  }`}
                >
                  <Link
                    to={`/s/${item.id}${view === 'trajectory' ? '/trajectory' : ''}`}
                    className="min-w-0 flex-1 px-3 py-2 text-left text-sm"
                  >
                    <div className="truncate font-medium">{item.title}</div>
                    <div className="mt-0.5 font-mono text-[10px] opacity-70">
                      {item.id.slice(0, 8)} · {item.eventCount} events
                    </div>
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
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--dsw-border)] px-3 py-3">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${live ? 'bg-emerald-50 text-emerald-700' : 'bg-black/5 text-[var(--dsw-label-3)]'}`}
          >
            {live ? 'Live' : 'Connecting'}
          </span>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full text-[var(--dsw-label-2)] hover:bg-black/5"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.3 3.2a1.8 1.8 0 0 1 3.4 0l.2 1a1.8 1.8 0 0 0 2.5 1.1l.9-.5a1.8 1.8 0 0 1 2.5 2.5l-.5.9a1.8 1.8 0 0 0 1.1 2.5l1 .2a1.8 1.8 0 0 1 0 3.4l-1 .2a1.8 1.8 0 0 0-1.1 2.5l.5.9a1.8 1.8 0 0 1-2.5 2.5l-.9-.5a1.8 1.8 0 0 0-2.5 1.1l-.2 1a1.8 1.8 0 0 1-3.4 0l-.2-1a1.8 1.8 0 0 0-2.5-1.1l-.9.5a1.8 1.8 0 0 1-2.5-2.5l.5-.9a1.8 1.8 0 0 0-1.1-2.5l-1-.2a1.8 1.8 0 0 1 0-3.4l1-.2a1.8 1.8 0 0 0 1.1-2.5l-.5-.9a1.8 1.8 0 0 1 2.5-2.5l.9.5a1.8 1.8 0 0 0 2.5-1.1z"
              />
              <circle cx="12" cy="12" r="2.4" />
            </svg>
          </button>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
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
        <div
          className={
            view === 'chat'
              ? 'mx-auto flex min-h-0 w-full max-w-[calc(var(--dsw-chat-width)+32px)] flex-1 flex-col overflow-hidden px-4 pb-4'
              : 'flex min-h-0 w-full flex-1 flex-col overflow-hidden'
          }
        >
          <div
            className={
              view === 'chat'
                ? 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain py-4'
                : 'flex min-h-0 flex-1 flex-col overflow-hidden'
            }
          >
            {view === 'chat' ? props.renderSlot('stage') : props.renderSlot('trajectory')}
          </div>
          {view === 'chat' ? (
            <div className="shrink-0 space-y-2 bg-[var(--dsw-bg)] pt-1 pb-3">
              {props.renderSlot('dock')}
              {props.renderSlot('composer')}
            </div>
          ) : null}
        </div>
      </main>

      <div
        className={`fixed inset-0 z-20 flex items-center justify-center bg-black/40 ${settingsOpen ? '' : 'hidden'}`}
        onClick={() => setSettingsOpen(false)}
      >
        <div
          className="flex h-[min(800px,calc(100vh-48px))] w-[min(800px,calc(100vw-48px))] overflow-hidden rounded-[24px] bg-white shadow-2xl"
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
                className="rounded-full px-2 py-1 text-sm text-[var(--dsw-label-3)] hover:bg-black/5"
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
  ctx.slots.fill('root', Shell, {
    children: {
      sidebar: { kind: 'single' },
      demos: { kind: 'list' },
      dock: { kind: 'list' },
      stage: { kind: 'list' },
      trajectory: { kind: 'list' },
      composer: { kind: 'single' },
      settings: { kind: 'list' },
      log: { kind: 'single' },
      routes: { kind: 'single' },
    },
    props: () => ({
      useSnapshot: bindSnapshot(ctx.snapshot as SnapshotService),
      useSessionView: bindSessionView(ctx.sessionView as SessionViewService),
      sessionView: ctx.sessionView as SessionViewService,
    }),
  })
}
