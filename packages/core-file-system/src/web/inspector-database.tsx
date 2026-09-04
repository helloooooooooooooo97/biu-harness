import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, CircleStackIcon, XMarkIcon } from '@heroicons/react/16/solid'
import type { SlotProps } from '@biu/type-slots'
import type { CollectionInfo } from '@biu/type-file-system'
import type { CollectionChrome } from '@biu/type-file-system/ui'
import { parseAppPath } from '@biu/web-session-view'
import { listenOutsideDismiss } from '@biu/public-ui'
import { buildCrumbs, pathForCrumbTarget, type Crumb, type CrumbTarget } from './sidebar-nav.ts'
import { CollectionBrowser } from './browser.tsx'
import { CrumbTrail } from './crumb-trail.tsx'
import { defaultViewId, loadRecords, loadViews, viewForPath } from './view-storage.ts'
import { builtinAllViewId } from '../catalog-views.ts'
import { DATA_MODULE, DATA_MODULE_ID, databaseAllViewPath, databaseRecordPath, databaseViewPath } from './database-path.ts'
import {
  getInspectorDbPath,
  isInspectorAgentWorking,
  setInspectorDbPath,
  subscribeInspectorAgentWorking,
  subscribeInspectorDbPath,
} from './inspector-db-route.ts'
import { getDatabaseUi } from './database-ui.ts'
import { TableGlyph } from './nav-glyphs.tsx'
import { viewsForRegisteredCollection } from './collection-nav.ts'

const tabIcons = new Map<string, ComponentType<{ className?: string }>>()

export function collectionTabIcon(icon?: string) {
  const key = icon ?? ''
  const cached = tabIcons.get(key)
  if (cached) return cached
  function Icon({ className }: { className?: string }) {
    return <TableGlyph icon={icon} className={className ?? 'size-4'} />
  }
  tabIcons.set(key, Icon)
  return Icon
}

const EMPTY_CHROME: CollectionChrome = {}
const EMPTY_FILTERS: Record<string, string> = {}

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

function defaultInspectorDbPath(tables: CollectionInfo[], seedCollection?: string) {
  const seeded = seedCollection ? tables.find((item) => item.path === seedCollection) : undefined
  const first = seeded ?? tables[0]
  if (!first?.path) return ''
  return databaseViewPath(first.path, defaultViewId(first.path))
}

function useBindInspectorDbPath(paneId: string, tables: CollectionInfo[], seedCollection?: string) {
  const inspectorPath = useInspectorDbPath(paneId)
  useEffect(() => {
    if (inspectorPath) return
    const fallback = defaultInspectorDbPath(tables, seedCollection)
    if (fallback) setInspectorDbPath(paneId, fallback)
  }, [inspectorPath, paneId, seedCollection, tables])
  return inspectorPath || defaultInspectorDbPath(tables, seedCollection)
}

function useInspectorAgentWorking(collection: string) {
  return useSyncExternalStore(
    subscribeInspectorAgentWorking,
    () => isInspectorAgentWorking(collection),
    () => false,
  )
}

function paneOf(props: { paneId?: unknown }) {
  return String(props.paneId || 'database')
}

function seedOf(props: { seedCollection?: unknown }) {
  return typeof props.seedCollection === 'string' ? props.seedCollection : ''
}

function splitHref(href: string) {
  const cut = href.indexOf('?')
  if (cut < 0) return { pathname: href, search: '' }
  return { pathname: href.slice(0, cut), search: href.slice(cut) }
}

function crumbsForRoute(
  pathname: string,
  tables: CollectionInfo[],
): { crumbs: Crumb[]; collection: string; viewId?: string; recordId?: string } {
  const parsed = parseAppPath(pathname, [DATA_MODULE])
  const collection = parsed.kind === 'collection-view' || parsed.kind === 'record' ? parsed.collection : ''
  const table = tables.find((item) => item.path === collection)
  const stored = collection ? loadViews(collection) : []
  const views = viewsForRegisteredCollection(collection, tables, stored)
  const urlViewId =
    parsed.kind === 'collection-view' || parsed.kind === 'record' ? parsed.viewId : undefined
  const recordId = parsed.kind === 'record' ? parsed.recordId : undefined
  const resolvedView = collection ? viewForPath(collection, urlViewId) : null
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

export function DatabaseInspectorTab({
  active,
  onActivate,
  onClose,
  paneId,
  seedCollection,
}: {
  active?: boolean
  onActivate?: () => void
  onClose?: () => void
  paneId?: string
  seedCollection?: string
}) {
  const id = paneOf({ paneId })
  const collections = useInspectorCollections()
  const tables = useMemo(
    () => collections.filter((row) => row.path && row.path !== '/'),
    [collections],
  )
  const inspectorPath = useBindInspectorDbPath(id, tables, seedCollection)
  const { collection: tabCollection } = crumbsForRoute(inspectorPath, tables)
  const agentWorking = useInspectorAgentWorking(tabCollection || seedCollection || '')
  const [trailOpen, setTrailOpen] = useState(false)
  const crumbRef = useRef<HTMLElement>(null)
  const tabRef = useRef<HTMLDivElement>(null)
  useViewTick()
  useEffect(() => {
    return listenOutsideDismiss(
      () => {
        setTrailOpen(false)
      },
      (target) =>
        Boolean(tabRef.current?.contains(target) || (target instanceof Element && target.closest('[data-fsdb-crumb-menu]'))),
    )
  }, [])
  const { crumbs } = crumbsForRoute(inspectorPath, tables)
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
      ref={tabRef}
      className={`inspector-tab inspector-crumb-tab${active ? ' is-active' : ''}${trailOpen ? ' is-crumb-open' : ''}${agentWorking ? ' is-agent-working' : ''}`}
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
          onActivate={onActivate}
          allowMenu={trailOpen}
          lockRootCrumb
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
      <span className="inspector-crumb-actions">
        {crumbs.length > 1 ? (
          <button
            type="button"
            className={`inspector-crumb-toggle${trailOpen ? ' is-open' : ''}`}
            title={trailOpen ? '收起面包屑' : '展开面包屑'}
            aria-label={trailOpen ? '收起面包屑' : '展开面包屑'}
            aria-expanded={trailOpen}
            data-testid="inspector-crumb-toggle"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onActivate?.()
              setTrailOpen((open) => !open)
            }}
          >
            {trailOpen ? (
              <ChevronLeftIcon aria-hidden className="size-3" />
            ) : (
              <ChevronRightIcon aria-hidden className="size-3" />
            )}
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            className="inspector-crumb-close"
            title="关闭"
            aria-label="关闭此栏"
            data-testid="inspector-tab-close"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onClose()
            }}
          >
            <XMarkIcon aria-hidden className="size-3" />
          </button>
        ) : null}
      </span>
    </div>
  )
}

export function DatabaseInspectorBrowse(props: SlotProps) {
  const extra = props as SlotProps & { paneId?: unknown; seedCollection?: unknown }
  const id = paneOf(extra)
  const ui = getDatabaseUi()
  const collections = useInspectorCollections()
  const tables = useMemo(
    () => collections.filter((row) => row.path && row.path !== '/'),
    [collections],
  )
  const inspectorPath = useBindInspectorDbPath(id, tables, seedOf(extra))
  const agentWorking = useInspectorAgentWorking(seedOf(extra) || '')
  useViewTick()
  const { pathname, search } = splitHref(inspectorPath)
  const { collection, viewId, recordId } = crumbsForRoute(pathname, tables)
  const currentPath = collection
  const chrome = useSyncExternalStore(
    (fn) => (ui ? ui.subscribe(fn) : () => undefined),
    () => (currentPath ? ui?.chrome(currentPath) ?? EMPTY_CHROME : EMPTY_CHROME),
    () => (currentPath ? ui?.chrome(currentPath) ?? EMPTY_CHROME : EMPTY_CHROME),
  )
  const lockedFilters = chrome.lockedFiltersFromSearch?.(search) ?? EMPTY_FILTERS
  const table = tables.find((item) => item.path === currentPath)
  const title = table ? tableLabel(table) : '数据'
  const liveWorking = useInspectorAgentWorking(currentPath)

  if (!currentPath) {
    return <p className="fsdb-inspector-empty">没有数据表</p>
  }

  return (
    <div
      key={inspectorPath}
      className={`fsdb-agent-follow${liveWorking || agentWorking ? ' is-working' : ''}`}
      data-testid="fsdb-agent-follow"
      aria-busy={liveWorking || agentWorking}
    >
    <CollectionBrowser
      embed
      moduleId={DATA_MODULE_ID}
      collectionPath={currentPath}
      title={title}
      blurb={table?.view?.blurb ?? ''}
      chrome={chrome}
      tables={tables}
      lockedFilters={lockedFilters}
      routeRecordId={recordId ?? null}
      routeViewId={viewId}
      onOpenTable={(path, nextViewId) => {
        setInspectorDbPath(id, databaseViewPath(path, nextViewId ?? builtinAllViewId(path)))
      }}
      onOpenView={(nextViewId) => setInspectorDbPath(id, databaseViewPath(currentPath, nextViewId))}
      onOpenRecord={(recordIdNext, nextViewId, nextCollection) => {
        setInspectorDbPath(
          id,
          databaseRecordPath(nextCollection ?? currentPath, recordIdNext, nextViewId ?? viewId),
        )
      }}
      resolveViews={(path, user) => viewsForRegisteredCollection(path, tables, user)}
      onCloseRecord={() => {
        setInspectorDbPath(
          id,
          viewId ? databaseViewPath(currentPath, viewId) : databaseAllViewPath(currentPath),
        )
      }}
      onCrumbTarget={(target) => goInspector(id, target)}
    />
    </div>
  )
}
