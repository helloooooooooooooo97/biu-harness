import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { CircleStackIcon } from '@heroicons/react/16/solid'
import { useLocation } from 'react-router-dom'
import type { SlotProps } from '@biu/type-slots'
import type { CollectionInfo } from '@biu/type-file-system'
import type { CollectionChrome } from '@biu/type-file-system/ui'
import { parseAppPath } from '@biu/web-session-view'
import { buildCrumbs, pathForCrumbTarget, type Crumb, type CrumbTarget } from './sidebar-nav.ts'
import { CollectionBrowser } from './browser.tsx'
import { CrumbTrail } from './crumb-trail.tsx'
import { loadActiveViewId, loadRecords, loadViews } from './view-storage.ts'
import { databaseRecordPath, databaseViewPath } from './inspector-nav.ts'
import {
  getInspectorDbPath,
  seedInspectorDbPath,
  setInspectorDbPath,
  subscribeInspectorDbPath,
} from './inspector-db-route.ts'
import { getDatabaseUi } from './database-ui.ts'

const DATA_MODULE = { id: 'database', label: '数据', path: '/database' }
const EMPTY_CHROME: CollectionChrome = {}

type InspectorSnapshot = {
  subscribe: (fn: () => void) => () => void
  get: () => { collections?: CollectionInfo[] }
}

let snapshotRef: InspectorSnapshot | undefined

export function bindInspectorSnapshot(source: InspectorSnapshot) {
  snapshotRef = source
}

function subscribeInspectorSnapshot(fn: () => void) {
  if (!snapshotRef) return () => undefined
  return snapshotRef.subscribe(fn)
}

function readInspectorCollections() {
  return (snapshotRef?.get().collections ?? []) as CollectionInfo[]
}

function useInspectorCollections() {
  return useSyncExternalStore(subscribeInspectorSnapshot, readInspectorCollections, () => [] as CollectionInfo[])
}

let viewTick = 0

function tableLabel(table: CollectionInfo) {
  return table.view?.title ?? table.label ?? table.path.replace(/^\//, '')
}

function useViewTick() {
  return useSyncExternalStore(
    (fn) => {
      const bump = () => {
        viewTick += 1
        fn()
      }
      window.addEventListener('fsdb:change', bump)
      window.addEventListener('fsdb:crumb-labels', bump)
      window.addEventListener('storage', bump)
      return () => {
        window.removeEventListener('fsdb:change', bump)
        window.removeEventListener('fsdb:crumb-labels', bump)
        window.removeEventListener('storage', bump)
      }
    },
    () => viewTick,
    () => 0,
  )
}

function useInspectorDbPath(paneId: string) {
  return useSyncExternalStore(
    subscribeInspectorDbPath,
    () => getInspectorDbPath(paneId),
    () => '',
  )
}

function crumbsForRoute(
  pathname: string,
  tables: CollectionInfo[],
): { crumbs: Crumb[]; collection: string; viewId?: string; recordId?: string } {
  const parsed = parseAppPath(pathname, [DATA_MODULE])
  const collection = parsed.kind === 'collection-view' || parsed.kind === 'record' ? parsed.collection : ''
  const table = tables.find((item) => item.path === collection)
  const views = collection ? loadViews(collection) : []
  const urlViewId = parsed.kind === 'collection-view' ? parsed.viewId : undefined
  const recordId = parsed.kind === 'record' ? parsed.recordId : undefined
  const resolvedView =
    (urlViewId ? views.find((item) => item.id === urlViewId) : undefined) ??
    (collection ? views.find((item) => item.id === loadActiveViewId(collection, views)) : undefined) ??
    views[0]
  const activeViewId = resolvedView?.id ?? urlViewId
  const records = collection ? loadRecords(collection) : []
  const recordHit = recordId ? records.find((row) => row.id === recordId) : undefined
  const crumbs = buildCrumbs({
    collection,
    collectionLabel: table ? tableLabel(table) : collection,
    tables: tables.map((item) => ({ path: item.path, label: tableLabel(item), icon: item.view?.icon })),
    viewId: collection ? activeViewId : undefined,
    viewName: resolvedView?.name,
    views: views.map((item) => ({ id: item.id, name: item.name, mode: item.mode })),
    recordId,
    recordLabel: recordHit?.label ?? recordId,
    records,
  })
  return { crumbs, collection, viewId: activeViewId, recordId }
}

function goInspector(paneId: string, target: CrumbTarget) {
  setInspectorDbPath(paneId, pathForCrumbTarget(target))
}

function paneOf(props: { paneId?: unknown }) {
  return String(props.paneId || 'database')
}

export function DatabaseInspectorTab({
  active,
  onActivate,
  paneId,
}: {
  active?: boolean
  onActivate?: () => void
  paneId?: string
}) {
  const id = paneOf({ paneId })
  const location = useLocation()
  const inspectorPath = useInspectorDbPath(id)
  const [crumbOpen, setCrumbOpen] = useState<string | null>(null)
  const crumbRef = useRef<HTMLElement>(null)
  useViewTick()
  useEffect(() => {
    seedInspectorDbPath(id, location.pathname)
  }, [id, location.pathname])
  useEffect(() => {
    function onPointer(event: globalThis.MouseEvent) {
      const target = event.target as Node
      if (crumbRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-fsdb-crumb-menu]')) return
      setCrumbOpen(null)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [])
  const collections = useInspectorCollections()
  const tables = useMemo(
    () => collections.filter((row) => row.path && row.path !== '/'),
    [collections],
  )
  const { crumbs } = crumbsForRoute(inspectorPath || location.pathname, tables)
  const leaf = crumbs.at(-1)
  const leafChoice = leaf?.choices.find((item) => item.id === leaf.id)
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('biu:inspector-caption', {
        detail: {
          id,
          label: leaf?.label ?? '数据',
          kind: leaf?.kind,
          mode: leafChoice?.mode,
          icon: leafChoice?.icon,
          emoji: leafChoice?.emoji,
        },
      }),
    )
  }, [id, leaf?.id, leaf?.kind, leaf?.label, leafChoice?.emoji, leafChoice?.icon, leafChoice?.mode])

  return (
    <div
      className={`inspector-tab inspector-crumb-tab${active ? ' is-active' : ''}`}
      role="tab"
      aria-selected={Boolean(active)}
      data-testid="inspector-tab-database"
      data-pane={id}
      onClick={() => onActivate?.()}
      title={crumbs.map((item) => item.label).join(' / ') || '数据'}
    >
      {crumbs.length ? (
        <CrumbTrail
          crumbs={crumbs}
          openId={crumbOpen}
          onOpenId={setCrumbOpen}
          onActivate={onActivate}
          onPick={(target) => {
            onActivate?.()
            goInspector(id, target)
          }}
          navRef={crumbRef}
          className="inspector-crumb-full fsdb-crumbs"
          label="数据库位置"
        />
      ) : (
        <span className="inspector-crumb-leaf">
          <CircleStackIcon aria-hidden className="chat-view-project-icon" />
          <span className="chat-view-project-name">数据</span>
        </span>
      )}
    </div>
  )
}

export function DatabaseInspectorBrowse(props: SlotProps) {
  const id = paneOf(props)
  const ui = getDatabaseUi()
  const location = useLocation()
  const inspectorPath = useInspectorDbPath(id)
  useViewTick()
  useEffect(() => {
    seedInspectorDbPath(id, location.pathname)
  }, [id, location.pathname])
  const collections = useInspectorCollections()
  const tables = useMemo(
    () => collections.filter((row) => row.path && row.path !== '/'),
    [collections],
  )
  const pathname = inspectorPath || location.pathname
  const { collection, viewId, recordId } = crumbsForRoute(pathname, tables)
  const currentPath = collection || tables[0]?.path || ''
  const table = tables.find((item) => item.path === currentPath)
  const title = table ? tableLabel(table) : '数据'
  const chrome = useSyncExternalStore(
    (fn) => (ui ? ui.subscribe(fn) : () => undefined),
    () => (currentPath ? ui?.chrome(currentPath) ?? EMPTY_CHROME : EMPTY_CHROME),
    () => (currentPath ? ui?.chrome(currentPath) ?? EMPTY_CHROME : EMPTY_CHROME),
  )

  if (!currentPath) {
    return <p className="fsdb-inspector-empty">没有数据表</p>
  }

  return (
    <CollectionBrowser
      embed
      moduleId="database"
      collectionPath={currentPath}
      title={title}
      blurb={table?.view?.blurb ?? ''}
      chrome={chrome}
      tables={tables}
      routeRecordId={recordId ?? null}
      routeViewId={viewId}
      onOpenTable={(path, nextViewId) => {
        setInspectorDbPath(id, databaseViewPath(path, nextViewId ?? loadActiveViewId(path, loadViews(path)) ?? undefined))
      }}
      onOpenView={(nextViewId) => setInspectorDbPath(id, databaseViewPath(currentPath, nextViewId))}
      onOpenRecord={(recordIdNext, _viewId, nextCollection) => {
        setInspectorDbPath(id, databaseRecordPath(nextCollection ?? currentPath, recordIdNext))
      }}
      onCloseRecord={() => {
        setInspectorDbPath(id, databaseViewPath(currentPath, loadActiveViewId(currentPath, loadViews(currentPath)) ?? undefined))
      }}
      onCrumbTarget={(target) => goInspector(id, target)}
    />
  )
}
