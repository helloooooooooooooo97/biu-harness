import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Context } from 'cordis'
import { LuPlay, LuPuzzle, LuSquare, LuTrash2 } from 'react-icons/lu'
import { useSlotEntries } from '@biu/web-slots'
import type { SlotsService } from '@biu/web-slots'

export const name = 'plugin-store-ui'
export const inject = ['slots', 'appModules']

type StoreListing = {
  id: string
  name: string
  blurb: string
  enabled: boolean
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

function PluginStorePage({ compact = false }: { compact?: boolean }) {
  const [items, setItems] = useState<StoreListing[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [pendingUninstall, setPendingUninstall] = useState<string | null>(null)

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

  async function openPlugin(id: string) {
    setBusy(`on:${id}`)
    try {
      await readJson('/api/plugin-store/open', {
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

  async function closePlugin(id: string) {
    setBusy(`off:${id}`)
    try {
      await readJson('/api/plugin-store/close', {
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
    setBusy(`rm:${id}`)
    setPendingUninstall(null)
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

  const pending = items.find((item) => item.id === pendingUninstall) ?? null
  const iconBtn =
    'grid size-6 shrink-0 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent text-[var(--dsw-label-3)] hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-label)] disabled:opacity-40'

  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-auto ${compact ? 'px-2.5 py-2.5' : 'px-5 py-4'}`}
      data-testid={compact ? 'plugin-store-inspector' : 'plugin-store-page'}
    >
      {compact ? null : (
        <header className="mb-3 flex items-baseline gap-2">
          <h1 className="m-0 text-[13px] font-semibold tracking-tight text-[var(--dsw-label)]">插件</h1>
          <span className="text-[11px] tabular-nums text-[var(--dsw-label-3)]">{items.length}</span>
        </header>
      )}

      {error ? (
        <p className="mb-3 text-[11px] leading-[1.45] text-[var(--dsw-danger)]" data-testid="plugin-store-error">
          {error}
        </p>
      ) : null}

      {items.length === 0 && !error ? (
        <p className="m-0 text-[11px] leading-[1.45] text-[var(--dsw-label-3)]" data-testid="plugin-store-empty">
          没有插件
        </p>
      ) : (
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-2 rounded-[8px] border border-[var(--dsw-border)] bg-[var(--dsw-surface)] px-2.5 py-2"
            data-testid={`plugin-store-card-${item.id}`}
            data-biu-kind="plugin"
            data-biu-id={item.id}
            data-biu-label={item.name}
          >
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate text-[12px] font-medium leading-[1.3] text-[var(--dsw-label)]">
                  {item.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] leading-[1.3] text-[var(--dsw-label-3)]">{item.id}</span>
                {item.enabled ? (
                  <span className="shrink-0 rounded-[4px] bg-[var(--dsw-ok)]/12 px-1 py-px text-[9px] font-semibold tracking-wide text-[var(--dsw-ok)]">
                    {item.running ? '运行中' : '已打开'}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-[4px] bg-[var(--dsw-hover)] px-1 py-px text-[9px] font-medium text-[var(--dsw-label-3)]">
                    已关闭
                  </span>
                )}
              </div>
              {item.blurb ? (
                <p className="mt-0.5 mb-0 line-clamp-2 text-[11px] leading-[1.45] text-[var(--dsw-label-3)]">
                  {item.blurb}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-px pt-px">
              {item.enabled ? (
                <button
                  type="button"
                  className={iconBtn}
                  data-testid={`plugin-store-close-${item.id}`}
                  data-biu-action="close"
                  title="关闭"
                  aria-label={`关闭 ${item.name}`}
                  disabled={Boolean(busy?.endsWith(`:${item.id}`))}
                  onClick={() => void closePlugin(item.id)}
                >
                  <LuSquare className="size-3" />
                </button>
              ) : (
                <button
                  type="button"
                  className={iconBtn}
                  data-testid={`plugin-store-open-${item.id}`}
                  data-biu-action="open"
                  title="打开"
                  aria-label={`打开 ${item.name}`}
                  disabled={Boolean(busy?.endsWith(`:${item.id}`))}
                  onClick={() => void openPlugin(item.id)}
                >
                  <LuPlay className="size-3" />
                </button>
              )}
              <button
                type="button"
                className={`${iconBtn} hover:text-[var(--dsw-danger)]`}
                data-testid={`plugin-store-uninstall-${item.id}`}
                title="卸载"
                aria-label={`卸载 ${item.name}`}
                disabled={Boolean(busy?.endsWith(`:${item.id}`))}
                onClick={() => setPendingUninstall(item.id)}
              >
                <LuTrash2 className="size-3" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      )}

      {pending && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4"
              data-testid="plugin-store-uninstall-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="plugin-store-uninstall-title"
              onClick={() => {
                if (busy?.startsWith('rm:')) return
                setPendingUninstall(null)
              }}
            >
              <div
                className="w-[min(100%,320px)] rounded-[10px] border border-[var(--dsw-border)] bg-[var(--dsw-sidebar)] p-4 text-[var(--dsw-label)]"
                onClick={(event) => event.stopPropagation()}
              >
                <h2 id="plugin-store-uninstall-title" className="m-0 text-[13px] font-semibold">
                  卸载「{pending.name}」？
                </h2>
                <p className="mt-1.5 mb-0 text-[11px] leading-[1.45] text-[var(--dsw-label-3)]">
                  卸载后会永久删除这份插件代码，货架上也会消失。若只是暂时不用，请点关闭。
                </p>
                <div className="mt-3 flex justify-end gap-1.5">
                  <button
                    type="button"
                    className="rounded-[6px] border-0 bg-[var(--dsw-hover)] px-2.5 py-1 text-[11px] text-[var(--dsw-label)] hover:bg-[#353535]"
                    data-testid="plugin-store-uninstall-cancel"
                    disabled={busy === `rm:${pending.id}`}
                    onClick={() => setPendingUninstall(null)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="rounded-[6px] border-0 bg-[var(--dsw-hover)] px-2.5 py-1 text-[11px] font-medium text-[var(--dsw-label)] hover:bg-[#353535]"
                    data-testid="plugin-store-uninstall-confirm"
                    data-biu-action="uninstall"
                    disabled={busy === `rm:${pending.id}`}
                    onClick={() => void uninstall(pending.id)}
                  >
                    {busy === `rm:${pending.id}` ? '卸载中…' : '确认卸载'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
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

function PluginStoreInspectorPanel() {
  return <PluginStorePage compact />
}

/** 运行中的商店插件 UI 浮层展示，不插入货架列表，避免开启后把卡片整体顶下去。 */
function PluginStoreExtrasLayer({ slots }: { slots: SlotsService }) {
  const extras = useSlotEntries(slots, 'plugin-store-extras')
  if (extras.length === 0) return null
  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center p-6"
      data-testid="plugin-store-extras"
    >
      <div className="pointer-events-auto flex max-h-full flex-col gap-2 overflow-auto">
        {extras
          .sort((a, b) => a.order - b.order)
          .map((entry) => {
            const Component = entry.Component
            return <Component key={entry.id} renderSlot={() => null} />
          })}
      </div>
    </div>
  )
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
    props: () => moduleProps,
  })
  slots.place('inspector-panels', PluginStoreInspectorPanel, {
    key: 'plugin-store-inspector',
    order: 11,
    props: () => inspectorProps,
  })
  slots.place('root-overlays', PluginStoreExtrasLayer, {
    key: 'plugin-store-extras-layer',
    order: 20,
    props: () => ({ slots }),
    children: {
      'plugin-store-extras': { kind: 'list' },
    },
  })
}
