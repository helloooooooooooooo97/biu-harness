import { useEffect, useState, useSyncExternalStore, type ComponentType } from 'react'
import type { Context } from 'cordis'
import { CircleStackIcon } from '@heroicons/react/16/solid'
import type { SlotProps } from '@biu/type-slots'
import { DATABASE_CHANNEL, type CollectionInfo, type CollectionView } from '@biu/type-file-system'
import type { CollectionChrome, DatabaseUi } from '@biu/type-file-system/ui'
import { CollectionBrowser } from './browser.tsx'
import { DatabaseUiService } from './database-ui.ts'
import {
  bootLoadCollections,
  collectionNavKey,
} from './nav-boot.ts'
import { pushAllSavedViews } from './view-storage.ts'

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

const DATA_MODULE_ID = 'database'
const DATA_MODULE_PATH = '/database'

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
  const tables = (props.tables as CollectionInfo[] | undefined) ?? []
  const [path, setPath] = useState(() => tables[0]?.path ?? '')
  const [focusRecordId, setFocusRecordId] = useState<string | null>(null)
  useEffect(() => {
    if (!tables.length) return
    if (tables.some((row) => row.path === path)) return
    setPath(tables[0]!.path)
  }, [path, tables])
  const row = tables.find((item) => item.path === path) ?? tables[0]
  const currentPath = row?.path ?? ''
  const ui = props.databaseUi as DatabaseUi | undefined
  const chrome = useSyncExternalStore(
    (fn) => (ui ? ui.subscribe(fn) : () => undefined),
    () => ui?.chrome(currentPath) ?? EMPTY_CHROME,
    () => ui?.chrome(currentPath) ?? EMPTY_CHROME,
  )
  useEffect(() => {
    pushAllSavedViews()
  }, [])
  if (!row) return null
  return (
    <CollectionBrowser
      moduleId={DATA_MODULE_ID}
      collectionPath={row.path}
      title={row.view?.title ?? row.label}
      blurb={row.view?.blurb ?? ''}
      chrome={chrome}
      tables={tables}
      onOpenTable={setPath}
      focusRecordId={focusRecordId}
      onFocusRecordConsumed={() => setFocusRecordId(null)}
      onRequestRecord={setFocusRecordId}
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
  let liveTables: CollectionInfo[] = []

  slots.place('root-overlays', RegisterErrorBanner, { key: 'fsdb-nav-errors', order: 80 })
  let stopped = false
  let readyTimer = 0
  const runSync = async (rows: CollectionInfo[]) => {
    const views = rows
      .filter((row) => row.view?.moduleId && row.view.route)
      .slice()
      .sort((a, b) => (a.view?.order ?? 50) - (b.view?.order ?? 50) || a.path.localeCompare(b.path))
    liveTables = views
    const live = views.length ? new Set([DATA_MODULE_ID]) : new Set<string>()
    for (const [id, dispose] of mounted) {
      if (live.has(id)) continue
      dispose()
      mounted.delete(id)
    }
    const errors: string[] = []
    if (!views.length) {
      setNavErrors(errors)
      return
    }
    const occupied = appModules.list()
    const pathHit = occupied.find((item) => item.id !== DATA_MODULE_ID && normalizeNavPath(item.path) === DATA_MODULE_PATH)
    if (pathHit) {
      errors.push(`路由重复：${DATA_MODULE_PATH} 已被「${pathHit.label}」占用`)
      setNavErrors(errors)
      return
    }
    const nameHit = occupied.find((item) => item.id !== DATA_MODULE_ID && item.label === '数据')
    if (nameHit) {
      errors.push(`名称重复：最左导航已有「数据」`)
      setNavErrors(errors)
      return
    }
    if (!mounted.has(DATA_MODULE_ID)) {
      try {
        const order = Math.min(...views.map((row) => row.view?.order ?? 50))
        const mod = appModules.register({
          id: DATA_MODULE_ID,
          label: '数据',
          path: DATA_MODULE_PATH,
          description: '任务、页面和插件',
          order,
          Icon: CircleStackIcon,
        })
        const slot = slots.place('app-modules', CollectionPage, {
          key: 'fsdb-database',
          order,
          props: () => ({
            moduleId: DATA_MODULE_ID,
            tables: liveTables,
            databaseUi: ctx.get('databaseUi') as DatabaseUi,
          }),
        })
        mounted.set(DATA_MODULE_ID, () => {
          void mod.dispose?.()
          void slot.dispose?.()
        })
      } catch (err) {
        errors.push(`无法挂到导航：${String(err)}`)
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
