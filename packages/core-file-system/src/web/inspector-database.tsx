import { useEffect, useMemo, useState, useSyncExternalStore, type MouseEvent } from 'react'
import { CircleStackIcon } from '@heroicons/react/16/solid'
import { useLocation } from 'react-router-dom'
import type { SlotProps } from '@biu/type-slots'
import type { CollectionInfo } from '@biu/type-file-system'
import type { CollectionChrome } from '@biu/type-file-system/ui'
import type { bindSnapshot } from '@biu/web-snapshot'
import { parseAppPath } from '@biu/web-session-view'
import { buildCrumbs, DATABASE_ROOT_PATH, pathForCrumbTarget, type Crumb, type CrumbTarget } from './sidebar-nav.ts'
import { CrumbItemGlyph } from './nav-glyphs.tsx'
import { CollectionBrowser } from './browser.tsx'
import { loadActiveViewId, loadViews } from './view-storage.ts'
import { databaseRecordPath, databaseViewPath } from './inspector-nav.ts'
import {
  getInspectorDbPath,
  seedInspectorDbPath,
  setInspectorDbPath,
  subscribeInspectorDbPath,
} from './inspector-db-route.ts'
import type { DatabaseUiService } from './database-ui.ts'

const DATA_MODULE = { id: 'database', label: '数据', path: '/database' }
const EMPTY_CHROME: CollectionChrome = {}

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
      window.addEventListener('storage', bump)
      return () => {
        window.removeEventListener('fsdb:change', bump)
        window.removeEventListener('storage', bump)
      }
    },
    () => viewTick,
    () => 0,
  )
}

function useInspectorDbPath() {
  return useSyncExternalStore(subscribeInspectorDbPath, getInspectorDbPath, () => '')
}

function crumbsForRoute(
  pathname: string,
  tables: CollectionInfo[],
): { crumbs: Crumb[]; collection: string; viewId?: string; recordId?: string } {
  const parsed = parseAppPath(pathname, [DATA_MODULE])
  const collection = parsed.kind === 'collection-view' || parsed.kind === 'record' ? parsed.collection : ''
  const viewId = parsed.kind === 'collection-view' ? parsed.viewId : undefined
  const recordId = parsed.kind === 'record' ? parsed.recordId : undefined
  const table = tables.find((item) => item.path === collection)
  const views = collection ? loadViews(collection) : []
  const activeViewId = viewId || (collection ? loadActiveViewId(collection, views) ?? undefined : undefined)
  const view = views.find((item) => item.id === activeViewId)
  const crumbs = buildCrumbs({
    collection,
    collectionLabel: table ? tableLabel(table) : collection,
    tables: tables.map((item) => ({ path: item.path, label: tableLabel(item), icon: item.view?.icon })),
    viewId: collection ? activeViewId : undefined,
    viewName: view?.name,
    views: views.map((item) => ({ id: item.id, name: item.name, mode: item.mode })),
    recordId,
    recordLabel: recordId,
  })
  return { crumbs, collection, viewId: activeViewId, recordId }
}

function goInspector(target: CrumbTarget | { kind: 'root' }) {
  if (target.kind === 'root') {
    setInspectorDbPath(DATABASE_ROOT_PATH)
    return
  }
  setInspectorDbPath(pathForCrumbTarget(target))
}

export function DatabaseInspectorTab({
  active,
  onActivate,
  useSnapshot,
}: {
  active?: boolean
  onActivate?: () => void
  useSnapshot?: ReturnType<typeof bindSnapshot>
}) {
  const location = useLocation()
  const inspectorPath = useInspectorDbPath()
  const [hover, setHover] = useState(false)
  useViewTick()
  useEffect(() => {
    seedInspectorDbPath(location.pathname)
  }, [location.pathname])
  const collections = (useSnapshot?.((state) => state.collections ?? []) ?? []) as CollectionInfo[]
  const tables = useMemo(
    () => collections.filter((row) => row.path && row.path !== '/'),
    [collections],
  )
  const { crumbs } = crumbsForRoute(inspectorPath || location.pathname, tables)
  const leaf = crumbs.at(-1)
  const leafChoice = leaf?.choices.find((item) => item.id === leaf.id)
  const showTrail = hover && crumbs.length > 0

  function go(event: MouseEvent, target: CrumbTarget | { kind: 'root' }) {
    event.preventDefault()
    event.stopPropagation()
    onActivate?.()
    goInspector(target)
  }

  return (
    <div
      className={`inspector-tab inspector-crumb-tab${active ? ' is-active' : ''}`}
      role="tab"
      aria-selected={Boolean(active)}
      data-testid="inspector-tab-database"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onActivate?.()}
    >
      {showTrail ? (
        <nav className="inspector-crumb-full" aria-label="数据库位置">
          <button type="button" className="fsdb-crumb-btn" onClick={(event) => go(event, { kind: 'root' })}>
            <CircleStackIcon aria-hidden className="chat-view-project-icon" />
            <span className="chat-view-project-name">数据库</span>
          </button>
          {crumbs.map((crumb) => {
            const current = crumb.choices.find((item) => item.id === crumb.id)
            return (
              <span key={crumb.id} className="fsdb-crumb">
                <span className="fsdb-crumb-sep" aria-hidden>/</span>
                <button type="button" className="fsdb-crumb-btn" onClick={(event) => go(event, crumb.target)}>
                  <CrumbItemGlyph kind={crumb.kind} icon={current?.icon} mode={current?.mode} emoji={current?.emoji} />
                  <span className="chat-view-project-name">{crumb.label}</span>
                </button>
              </span>
            )
          })}
        </nav>
      ) : (
        <span className="inspector-crumb-leaf">
          {leaf ? (
            <CrumbItemGlyph kind={leaf.kind} icon={leafChoice?.icon} mode={leafChoice?.mode} emoji={leafChoice?.emoji} />
          ) : (
            <CircleStackIcon aria-hidden className="chat-view-project-icon" />
          )}
          <span className="chat-view-project-name">{leaf?.label ?? '数据库'}</span>
        </span>
      )}
    </div>
  )
}

export function DatabaseInspectorBrowse(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const ui = props.databaseUi as DatabaseUiService | undefined
  const location = useLocation()
  const inspectorPath = useInspectorDbPath()
  useViewTick()
  useEffect(() => {
    seedInspectorDbPath(location.pathname)
  }, [location.pathname])
  const collections = (useSnapshot((state) => state.collections ?? []) ?? []) as CollectionInfo[]
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
      key={currentPath}
      moduleId="database"
      collectionPath={currentPath}
      title={title}
      blurb={table?.view?.blurb ?? ''}
      chrome={chrome}
      tables={tables}
      routeRecordId={recordId ?? null}
      routeViewId={viewId}
      onOpenTable={(path, nextViewId) => {
        setInspectorDbPath(databaseViewPath(path, nextViewId ?? loadActiveViewId(path, loadViews(path)) ?? undefined))
      }}
      onOpenView={(nextViewId) => setInspectorDbPath(databaseViewPath(currentPath, nextViewId))}
      onOpenRecord={(id, _viewId, nextCollection) => {
        setInspectorDbPath(databaseRecordPath(nextCollection ?? currentPath, id))
      }}
      onCloseRecord={() => {
        setInspectorDbPath(databaseViewPath(currentPath, loadActiveViewId(currentPath, loadViews(currentPath)) ?? undefined))
      }}
      onCrumbTarget={(target) => goInspector(target)}
    />
  )
}
