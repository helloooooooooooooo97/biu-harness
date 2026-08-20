import { useEffect, useState } from 'react'
import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'
import { bindSnapshot, type Snapshot, type SnapshotService } from '../infrastructure/snapshot.ts'
import { bindSessionView, type SessionViewService } from '../infrastructure/session-view.ts'
import { BrandWordmark, FishLogo } from './brand.tsx'

export const name = 'shell'
export const inject = ['slots', 'snapshot', 'sessionView']

function Shell(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const sessionView = props.sessionView as SessionViewService
  const snap = useSnapshot((state: Snapshot) => state)
  const live = snap.plugins.some((plugin) => plugin.enabled)
  const sessions = useSessionView((state) => state.sessions)
  const sessionId = useSessionView((state) => state.sessionId)
  const view = useSessionView((state) => state.view)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    void sessionView.refreshSessions()
  }, [sessionView])

  return (
    <div className="grid min-h-screen grid-cols-[280px_minmax(0,1fr)] bg-[var(--dsw-bg)] text-[var(--dsw-label)]">
      <aside className="flex flex-col border-r border-[var(--dsw-border)] bg-[var(--dsw-sidebar)]">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <BrandWordmark />
        </div>
        <div className="px-3 pb-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-[var(--dsw-border)] bg-white px-3 py-2 text-sm font-medium hover:bg-[var(--dsw-business-soft)]"
            onClick={() => void sessionView.newSession()}
          >
            <span className="text-lg leading-none">+</span>
            New Session
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold tracking-wider text-[var(--dsw-label-3)] uppercase">Sessions</span>
            {sessionId ? (
              <button
                type="button"
                className="text-[11px] text-[var(--dsw-business)] hover:underline"
                onClick={() => void sessionView.forkCurrent()}
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
                <button
                  key={item.id}
                  type="button"
                  className={`mb-1 w-full rounded-[12px] px-3 py-2 text-left text-sm ${
                    active ? 'bg-[var(--dsw-business-soft)] text-[var(--dsw-business)]' : 'hover:bg-black/[0.03]'
                  }`}
                  onClick={() => void sessionView.load(item.id)}
                >
                  <div className="truncate font-medium">{item.title}</div>
                  <div className="mt-0.5 font-mono text-[10px] opacity-70">
                    {item.id.slice(0, 8)} · {item.eventCount} events
                  </div>
                </button>
              )
            })
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[var(--dsw-border)] px-3 py-3">
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

      <main className="flex min-w-0 flex-col">
        <header className="flex h-12 items-center gap-4 border-b border-[var(--dsw-border)] px-6">
          <button
            type="button"
            className={`relative pb-3 pt-3 text-[13px] font-medium ${view === 'chat' ? 'text-[var(--dsw-business)]' : 'text-[var(--dsw-label-3)]'}`}
            onClick={() => sessionView.setView('chat')}
          >
            Chat
            {view === 'chat' ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--dsw-business)]" /> : null}
          </button>
          <button
            type="button"
            className={`relative pb-3 pt-3 text-[13px] font-medium ${view === 'trajectory' ? 'text-[var(--dsw-business)]' : 'text-[var(--dsw-label-3)]'}`}
            onClick={() => sessionView.setView('trajectory')}
          >
            Trajectory
            {view === 'trajectory' ? (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--dsw-business)]" />
            ) : null}
          </button>
        </header>
        <div
          className={
            view === 'chat'
              ? 'mx-auto flex w-full max-w-[calc(var(--dsw-chat-width)+32px)] flex-1 flex-col px-4 pb-4'
              : 'flex min-h-0 w-full flex-1 flex-col'
          }
        >
          <div className={`flex flex-1 flex-col overflow-y-auto ${view === 'chat' ? 'py-4' : ''}`}>
            {view === 'chat' ? props.renderSlot('stage') : props.renderSlot('trajectory')}
          </div>
          {view === 'chat' ? (
            <div className="sticky bottom-0 space-y-2 bg-[var(--dsw-bg)] pt-1 pb-3">
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
