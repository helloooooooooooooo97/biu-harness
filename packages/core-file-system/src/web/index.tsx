import { useSyncExternalStore, type ComponentType } from 'react'
import type { Context } from 'cordis'
import {
  ClipboardDocumentListIcon,
  FolderIcon,
  PuzzlePieceIcon,
  TableCellsIcon,
} from '@heroicons/react/16/solid'
import type { SlotProps } from '@biu/type-slots'
import { DATABASE_CHANNEL, type CollectionInfo, type CollectionView } from '@biu/type-file-system'
import type { CollectionChrome, DatabaseUi } from '@biu/type-file-system/ui'
import { CollectionBrowser } from './browser.tsx'
import { DatabaseUiService } from './database-ui.ts'
import { bootLoadCollections, collectionNavKey } from './nav-boot.ts'

type SlotsService = {
  place: (slot: string, view: unknown, opts: { key: string; order?: number; props?: () => Record<string, unknown> }) => { dispose?: () => unknown }
}

type AppModule = {
  id: string
  label: string
  path: string
}

type AppModulesService = {
  list: () => AppModule[]
  register: (mod: {
    id: string
    label: string
    path: string
    description?: string
    order?: number
    Icon?: ComponentType<{ className?: string }>
  }) => { dispose?: () => unknown }
  markNavReady?: () => void
}

type SnapshotService = {
  onMessage: (type: string, handler: (payload: unknown) => void) => () => void
  get?: () => { collections?: CollectionInfo[] }
  subscribe?: (fn: () => void) => () => void
}

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  'clipboard-document-list': ClipboardDocumentListIcon,
  clipboard: ClipboardDocumentListIcon,
  'puzzle-piece': PuzzlePieceIcon,
  puzzle: PuzzlePieceIcon,
  'table-cells': TableCellsIcon,
  folder: FolderIcon,
}

function resolveIcon(name?: string) {
  if (!name) return TableCellsIcon
  return ICONS[name] ?? ICONS[name.trim().toLowerCase()] ?? TableCellsIcon
}

function normalizeNavPath(path: string) {
  const raw = String(path || '/').trim() || '/'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  if (withSlash === '/') return '/'
  return withSlash.replace(/\/+$/, '') || '/'
}

export function navConflict(view: CollectionView, title: string, modules: AppModule[], selfId: string): string | null {
  const route = normalizeNavPath(view.route)
  const pathHit = modules.find((item) => item.id !== selfId && normalizeNavPath(item.path) === route)
  if (pathHit) return `路由重复：${route} 已被「${pathHit.label}」占用，请换一个路由再登记`
  const nameHit = modules.find((item) => item.id !== selfId && item.label === title)
  if (nameHit) return `名称重复：最左导航已有「${title}」，请换一个名字`
  return null
}

const EMPTY_CHROME: CollectionChrome = {}

function CollectionPage(props: SlotProps) {
  const path = String(props.collectionPath ?? '')
  const ui = props.databaseUi as DatabaseUi | undefined
  const chrome = useSyncExternalStore(
    (fn) => (ui ? ui.subscribe(fn) : () => undefined),
    () => ui?.chrome(path) ?? EMPTY_CHROME,
    () => ui?.chrome(path) ?? EMPTY_CHROME,
  )
  return (
    <CollectionBrowser
      moduleId={String(props.moduleId ?? '')}
      collectionPath={path}
      title={String(props.title ?? '')}
      blurb={String(props.blurb ?? '')}
      chrome={chrome}
    />
  )
}

async function loadCollections(): Promise<CollectionInfo[]> {
  const res = await fetch('/api/db/stat?path=/')
  const body = (await res.json()) as { collections?: CollectionInfo[]; error?: string }
  if (!res.ok) throw new Error(body.error || res.statusText)
  return body.collections ?? []
}

let navErrors: string[] = []
const errorListeners = new Set<() => void>()

function setNavErrors(next: string[]) {
  navErrors = next
  for (const fn of errorListeners) fn()
}

function RegisterErrorBanner() {
  const errors = useSyncExternalStore(
    (fn) => {
      errorListeners.add(fn)
      return () => errorListeners.delete(fn)
    },
    () => navErrors,
    () => navErrors,
  )
  if (!errors.length) return null
  return (
    <div className="fsdb-nav-errors" role="alert">
      <strong>Core-File System</strong>
      <ul>
        {errors.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export const name = 'core-file-system-ui'
export const inject = ['slots', 'appModules']

export function apply(ctx: Context) {
  new DatabaseUiService(ctx)
  const slots = ctx.get('slots') as SlotsService
  const appModules = ctx.get('appModules') as AppModulesService
  const mounted = new Map<string, () => void>()

  slots.place('root-overlays', RegisterErrorBanner, { key: 'fsdb-nav-errors', order: 80 })
  let stopped = false
  let readyTimer = 0
  const runSync = async (rows: CollectionInfo[]) => {
    const views = rows.filter((row) => row.view?.moduleId && row.view.route)
    const live = new Set(views.map((row) => row.view!.moduleId))
    for (const [id, dispose] of mounted) {
      if (live.has(id)) continue
      dispose()
      mounted.delete(id)
    }
    const errors: string[] = []
    const occupied = appModules.list()
    for (const row of views) {
      const view = row.view!
      const title = view.title ?? row.label
      const conflict = navConflict(view, title, occupied, view.moduleId)
      if (conflict) {
        errors.push(`「${title}」${conflict}`)
        continue
      }
      if (mounted.has(view.moduleId)) continue
      if (!resolveIcon(view.icon) || (view.icon && !ICONS[view.icon] && !ICONS[view.icon.trim().toLowerCase()])) {
        if (view.icon) errors.push(`「${title}」未知图标：${view.icon}，已改用默认图标`)
      }
      const blurb = view.blurb ?? ''
      const order = view.order ?? 50
      try {
        const mod = appModules.register({
          id: view.moduleId,
          label: title,
          path: view.route,
          description: blurb,
          order,
          Icon: resolveIcon(view.icon),
        })
        const slot = slots.place('app-modules', CollectionPage, {
          key: `fsdb-${view.moduleId}`,
          order,
          props: () => ({
            moduleId: view.moduleId,
            collectionPath: row.path,
            title,
            blurb,
            databaseUi: ctx.get('databaseUi') as DatabaseUi,
          }),
        })
        mounted.set(view.moduleId, () => {
          void mod.dispose?.()
          void slot.dispose?.()
        })
      } catch (err) {
        errors.push(`「${title}」无法挂到导航：${String(err)}`)
      }
    }
    setNavErrors(errors)
  }

  const sync = async (rows?: CollectionInfo[]) => {
    let next = rows
    if (!next) {
      try {
        next = await loadCollections()
      } catch {
        return
      }
    }
    await runSync(next)
    if (!collectionNavKey(next)) return
    window.clearTimeout(readyTimer)
    readyTimer = window.setTimeout(() => appModules.markNavReady?.(), 80)
  }

  ctx.effect(() => () => {
    stopped = true
    window.clearTimeout(readyTimer)
    for (const dispose of mounted.values()) dispose()
    mounted.clear()
    setNavErrors([])
  })
  ctx.inject(['snapshot'], (inner) => {
    const snapshot = inner.get('snapshot') as SnapshotService
    let lastKey = ''
    const fromSnap = () => {
      const rows = snapshot.get?.().collections ?? []
      const key = collectionNavKey(rows)
      if (!key || key === lastKey) return
      lastKey = key
      void sync(rows)
    }
    fromSnap()
    const offSnap = snapshot.subscribe?.(fromSnap)
    let debounce = 0
    const off = snapshot.onMessage(DATABASE_CHANNEL, () => {
      window.dispatchEvent(new Event('fsdb:change'))
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => void sync(), 40)
    })
    return () => {
      window.clearTimeout(debounce)
      offSnap?.()
      off()
    }
  })
  void bootLoadCollections(loadCollections, {
    stopped: () => stopped,
    onUpdate: (rows) => {
      if (stopped || !collectionNavKey(rows)) return
      void sync(rows)
    },
  }).then((rows) => {
    if (stopped) return
    return sync(rows)
  })
}

if (typeof document !== 'undefined') {
  const id = 'biu-core-file-system-nav-error-style'
  const style = document.getElementById(id) ?? document.createElement('style')
  style.id = id
  style.textContent = `
.fsdb-nav-errors{position:fixed;right:16px;bottom:16px;z-index:80;max-width:360px;border:1px solid var(--dsw-danger);border-radius:12px;padding:12px 14px;background:var(--dsw-surface);color:var(--dsw-label);box-shadow:0 8px 24px rgba(0,0,0,.24)}
.fsdb-nav-errors strong{display:block;margin-bottom:6px;color:var(--dsw-danger);font-size:12px}
.fsdb-nav-errors ul{margin:0;padding-left:18px;font-size:12px;line-height:1.5}
`
  if (!document.getElementById(id)) document.head.appendChild(style)
}
