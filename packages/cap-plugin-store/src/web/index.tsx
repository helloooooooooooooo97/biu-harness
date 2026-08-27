import { useCallback, useEffect, useState } from 'react'
import type { Context } from 'cordis'
import { LuPuzzle } from 'react-icons/lu'
import { useSlotEntries } from '@biu/web-slots'
import type { SlotsService } from '@biu/web-slots'

export const name = 'plugin-store-ui'
export const inject = ['slots', 'appModules']

type StoreListing = {
  id: string
  name: string
  blurb: string
  installed: boolean
  running: boolean
}

function PuzzleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'size-5'} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 3.5a2 2 0 0 1 2 2V7h4V5.5a2 2 0 1 1 4 0V7h1.5A1.5 1.5 0 0 1 21 8.5V11h-1.5a2 2 0 1 0 0 4H21v2.5a1.5 1.5 0 0 1-1.5 1.5H18v1.5a2 2 0 1 1-4 0V19h-4v1.5a2 2 0 1 1-4 0V19H4.5A1.5 1.5 0 0 1 3 17.5V15h1.5a2 2 0 1 0 0-4H3V8.5A1.5 1.5 0 0 1 4.5 7H6V5.5a2 2 0 0 1 2-2z"
      />
    </svg>
  )
}

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(body.error || res.statusText)
  return body
}

function PluginStorePage({ slots, compact = false }: { slots: SlotsService; compact?: boolean }) {
  const extras = useSlotEntries(slots, 'plugin-store-extras')
  const [items, setItems] = useState<StoreListing[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await readJson<{ items: StoreListing[] }>('/api/plugin-store')
      setItems(data.items ?? [])
      setError(null)
    } catch (err) {
      setError(String(err))
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      if (document.hidden) return
      void refresh()
    }, 2000)
    return () => window.clearInterval(timer)
  }, [refresh])

  async function install(id: string) {
    setBusy(id)
    try {
      await readJson('/api/plugin-store/install', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await refresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(null)
    }
  }

  async function uninstall(id: string) {
    setBusy(id)
    try {
      await readJson('/api/plugin-store/uninstall', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await refresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-auto ${compact ? 'px-3 py-3' : 'px-8 py-6'}`}
      data-testid={compact ? 'plugin-store-inspector' : 'plugin-store-page'}
    >
      {compact ? null : (
        <header className="mb-6">
          <h1 className="m-0 text-[22px] font-semibold tracking-tight text-[var(--dsw-label)]">插件</h1>
        </header>
      )}

      {error ? (
        <p className="mb-4 text-[13px] text-[var(--dsw-danger)]" data-testid="plugin-store-error">
          {error}
        </p>
      ) : null}

      {extras.length > 0 ? (
        <div className="mb-5 flex flex-col gap-2">
          {extras
            .sort((a, b) => a.order - b.order)
            .map((entry) => {
              const Component = entry.Component
              return <Component key={entry.id} renderSlot={() => null} />
            })}
        </div>
      ) : null}

      {items.length === 0 && !error ? (
        <p className="m-0 text-[13px] text-[var(--dsw-label-3)]" data-testid="plugin-store-empty">
          没有插件
        </p>
      ) : (
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((item) => (
          <li
            key={item.id}
            className={`flex items-center justify-between gap-3 rounded-[8px] border border-[var(--dsw-border)] bg-[var(--dsw-surface)] ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}`}
            data-testid={`plugin-store-card-${item.id}`}
            data-biu-kind="plugin"
            data-biu-id={item.id}
            data-biu-label={item.name}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-[var(--dsw-label)]">{item.name}</span>
                <span className="font-mono text-[11px] text-[var(--dsw-label-3)]">{item.id}</span>
                {item.installed ? (
                  <span className="rounded-[4px] bg-[var(--dsw-ok)]/15 px-1.5 py-px text-[10px] font-medium text-[var(--dsw-ok)]">
                    {item.running ? '运行中' : '已安装'}
                  </span>
                ) : (
                  <span className="rounded-[4px] bg-[var(--dsw-hover)] px-1.5 py-px text-[10px] text-[var(--dsw-label-3)]">
                    未安装
                  </span>
                )}
              </div>
              {item.blurb ? (
                <p className={`mt-1 m-0 leading-5 text-[var(--dsw-label-3)] ${compact ? 'text-[11px]' : 'text-[12px]'}`}>
                  {item.blurb}
                </p>
              ) : null}
            </div>
            {item.installed ? (
              <button
                type="button"
                className="shrink-0 rounded-[8px] border border-[var(--dsw-border)] px-3 py-1.5 text-[12px] text-[var(--dsw-label)] hover:bg-[var(--dsw-hover)]"
                data-testid={`plugin-store-uninstall-${item.id}`}
                data-biu-action="uninstall"
                disabled={busy === item.id}
                onClick={() => void uninstall(item.id)}
              >
                {busy === item.id ? '卸载中…' : '卸载'}
              </button>
            ) : (
              <button
                type="button"
                className="shrink-0 rounded-[8px] bg-[var(--dsw-business)] px-3 py-1.5 text-[12px] font-medium text-[var(--dsw-bg)] hover:opacity-90"
                data-testid={`plugin-store-install-${item.id}`}
                data-biu-action="install"
                disabled={busy === item.id}
                onClick={() => void install(item.id)}
              >
                {busy === item.id ? '安装中…' : '安装'}
              </button>
            )}
          </li>
        ))}
      </ul>
      )}
    </div>
  )
}

type AppModulesService = {
  register: (mod: {
    id: string
    label: string
    path: string
    description?: string
    order?: number
    Icon?: (props: { className?: string }) => unknown
  }) => unknown
}

const moduleProps = { moduleId: 'plugins' }
const inspectorProps = { tabId: 'plugins', tabLabel: '插件', tabIcon: LuPuzzle }

function PluginStoreInspectorPanel({ slots }: { slots: SlotsService }) {
  return <PluginStorePage slots={slots} compact />
}

export function apply(ctx: Context) {
  const slots = ctx.get('slots') as SlotsService | undefined
  const appModules = ctx.get('appModules') as AppModulesService | undefined
  if (!slots) throw new Error('slots service required')
  if (!appModules) throw new Error('appModules service required')
  appModules.register({
    id: 'plugins',
    label: '插件',
    path: '/plugins',
    description: 'Install prebuilt plugins without rebuilding the app',
    order: 30,
    Icon: PuzzleIcon,
  })
  slots.place('app-modules', PluginStorePage, {
    key: 'plugin-store-module',
    order: 30,
    props: () => ({ ...moduleProps, slots }),
    children: {
      'plugin-store-extras': { kind: 'list' },
    },
  })
  slots.place('inspector-panels', PluginStoreInspectorPanel, {
    key: 'plugin-store-inspector',
    order: 11,
    props: () => ({ ...inspectorProps, slots }),
  })
}
