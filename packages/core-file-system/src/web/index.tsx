import { useEffect, useMemo, useState, useSyncExternalStore, type ComponentType } from 'react'
import type { Context } from 'cordis'
import { useLocation, useNavigate } from 'react-router-dom'
import { CircleStackIcon } from '@heroicons/react/16/solid'
import type { SlotProps } from '@biu/type-slots'
import { DATABASE_CHANNEL, type CollectionInfo, type CollectionView } from '@biu/type-file-system'
import type { CollectionChrome } from '@biu/type-file-system/ui'
import { isLegacyDatabasePath, parseAppPath } from '@biu/web-session-view'
import { pathForCenter, pathForCrumbTarget, type CrumbTarget } from './sidebar-nav.ts'
import { CollectionBrowser } from './browser.tsx'
import { DatabaseUiService, getDatabaseUi } from './database-ui.ts'
import {
  bootLoadCollections,
  collectionNavKey,
} from './nav-boot.ts'
import { loadActiveViewId, loadViews, pushAllSavedViews } from './view-storage.ts'

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
const DATA_MODULE = { id: DATA_MODULE_ID, label: '数据', path: DATA_MODULE_PATH }

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

function defaultViewId(collectionPath: string) {
  return loadActiveViewId(collectionPath, loadViews(collectionPath)) ?? undefined
}

function CollectionPage(props: SlotProps) {
  const tables = (props.tables as CollectionInfo[] | undefined) ?? []
  const ui = getDatabaseUi()
  const location = useLocation()
  const navigate = useNavigate()
  const [expandedViewKey, setExpandedViewKey] = useState<string | null>(null)
  const parsed = useMemo(() => parseAppPath(location.pathname, [DATA_MODULE]), [location.pathname])
  const collectionFromRoute =
    parsed.kind === 'collection-view' || parsed.kind === 'record' ? parsed.collection : ''
  const viewFromRoute = parsed.kind === 'collection-view' ? parsed.viewId : undefined
  const recordFromRoute = parsed.kind === 'record' ? parsed.recordId : null
  const currentPath = collectionFromRoute || tables[0]?.path || ''
  const row = tables.find((item) => item.path === currentPath)
  const chrome = useSyncExternalStore(
    (fn) => (ui ? ui.subscribe(fn) : () => undefined),
    () => ui?.chrome(currentPath) ?? EMPTY_CHROME,
    () => ui?.chrome(currentPath) ?? EMPTY_CHROME,
  )

  const go = (
    next: { collection: string; viewId?: string; recordId?: string | null },
    opts?: { replace?: boolean },
  ) => {
    navigate(
      pathForCenter({
        collection: next.collection,
        viewId: next.viewId,
        recordId: next.recordId ?? undefined,
      }),
      opts,
    )
  }

  useEffect(() => {
    pushAllSavedViews()
  }, [])

  useEffect(() => {
    if (isLegacyDatabasePath(location.pathname) && (parsed.kind === 'collection-view' || parsed.kind === 'record')) {
      go(
        {
          collection: parsed.collection,
          viewId: parsed.kind === 'collection-view' ? parsed.viewId : undefined,
          recordId: parsed.kind === 'record' ? parsed.recordId : null,
        },
        { replace: true },
      )
    }
  }, [location.pathname, parsed])

  useEffect(() => {
    if (!tables.length) return
    if (parsed.kind === 'module' && parsed.moduleId === DATA_MODULE_ID) {
      const first = tables[0]!
      go({ collection: first.path }, { replace: true })
    }
  }, [parsed.kind, parsed.moduleId, tables])

  useEffect(() => {
    if (!tables.length || !collectionFromRoute) return
    if (tables.some((item) => item.path === collectionFromRoute)) return
    const first = tables[0]!
    go({ collection: first.path, viewId: defaultViewId(first.path) }, { replace: true })
  }, [collectionFromRoute, tables])

  if (!currentPath) return null
  const title = row?.view?.title ?? row?.label ?? currentPath.replace(/^\//, '')
  return (
    <CollectionBrowser
      moduleId={DATA_MODULE_ID}
      collectionPath={currentPath}
      title={title}
      blurb={row?.view?.blurb ?? ''}
      chrome={chrome}
      tables={tables}
      routeRecordId={recordFromRoute}
      routeViewId={viewFromRoute}
      expandedViewKey={expandedViewKey}
      onExpandedViewKeyChange={setExpandedViewKey}
      onOpenTable={(path, viewId) => go({ collection: path, viewId: viewId ?? defaultViewId(path) })}
      onOpenView={(viewId) => go({ collection: currentPath, viewId })}
      onOpenRecord={(recordId, _viewId, collection) =>
        go({ collection: collection ?? currentPath, recordId })
      }
      onCloseRecord={() =>
        go({ collection: currentPath, viewId: defaultViewId(currentPath) }, { replace: true })
      }
      onCrumbTarget={(target: CrumbTarget) => navigate(pathForCrumbTarget(target))}
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
