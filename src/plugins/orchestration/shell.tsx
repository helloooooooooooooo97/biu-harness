import { useState } from 'react'
import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'
import { bindSnapshot, type Snapshot, type SnapshotService } from '../infrastructure/snapshot.ts'

export const name = 'shell'
export const inject = ['slots', 'snapshot']

function Shell(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const snap = useSnapshot((state: Snapshot) => state)
  const live = snap.plugins.some((plugin) => plugin.enabled)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#1b1c1d]">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-[#4d6bfe] text-sm font-semibold text-white">
              h
            </span>
            <h1 className="text-base font-medium tracking-wide">hmr-dev</h1>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs ${live ? 'bg-[#1e3a2f] text-[#86efac]' : 'bg-[#2d2e30] text-[#9aa0a6]'}`}
            >
              {live ? '实时' : '连接中'}
            </span>
            {props.renderSlot('clock')}
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full text-[#e8eaed] hover:bg-[#2d2e30]"
              aria-label="设置"
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
        </header>

        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-4">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-6">{props.renderSlot('stage')}</div>
          <div className="sticky bottom-0 bg-[#1b1c1d] pb-3 pt-1">{props.renderSlot('composer')}</div>
        </main>
      </div>

      <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-[#3c4043] bg-[#202124] p-3">
        {props.renderSlot('rail')}
      </aside>

      <div
        className={`fixed inset-0 z-20 flex justify-end bg-black/50 ${settingsOpen ? '' : 'hidden'}`}
        onClick={() => setSettingsOpen(false)}
      >
        <aside
          className="flex h-full w-full max-w-md flex-col border-l border-[#3c4043] bg-[#202124] shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[#3c4043] px-4 py-3">
            <h2 className="text-sm font-medium">设置</h2>
            <button
              type="button"
              className="rounded-full px-2 py-1 text-sm text-[#9aa0a6] hover:bg-[#2d2e30]"
              onClick={() => setSettingsOpen(false)}
            >
              关闭
            </button>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
            <section>
              <h3 className="mb-3 text-xs font-semibold tracking-widest text-[#9aa0a6] uppercase">插件</h3>
              {props.renderSlot('sidebar')}
            </section>
            <section>
              <h3 className="mb-3 text-xs font-semibold tracking-widest text-[#9aa0a6] uppercase">助手</h3>
              {props.renderSlot('settings')}
            </section>
            <section>
              <h3 className="mb-3 text-xs font-semibold tracking-widest text-[#9aa0a6] uppercase">路由</h3>
              {props.renderSlot('routes')}
            </section>
            <section>
              <h3 className="mb-3 text-xs font-semibold tracking-widest text-[#9aa0a6] uppercase">事件</h3>
              {props.renderSlot('log')}
            </section>
          </div>
        </aside>
      </div>
    </div>
  )
}

export function apply(ctx: Context) {
  ctx.slots.fill('root', Shell, {
    children: {
      sidebar: { kind: 'single' },
      clock: { kind: 'single' },
      rail: { kind: 'list' },
      stage: { kind: 'list' },
      composer: { kind: 'single' },
      settings: { kind: 'list' },
      log: { kind: 'single' },
      routes: { kind: 'single' },
    },
    props: () => ({ useSnapshot: bindSnapshot(ctx.snapshot as SnapshotService) }),
  })
}
