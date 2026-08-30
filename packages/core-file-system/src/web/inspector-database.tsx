import { useMemo, useState, useSyncExternalStore, type MouseEvent } from 'react'
import { CircleStackIcon } from '@heroicons/react/16/solid'
import { useLocation, useNavigate } from 'react-router-dom'
import type { SlotProps } from '@biu/type-slots'
import type { CollectionInfo } from '@biu/type-file-system'
import type { bindSnapshot } from '@biu/web-snapshot'
import { parseAppPath } from '@biu/web-session-view'
import { buildCrumbs, DATABASE_ROOT_PATH, pathForCrumbTarget, type Crumb, type CrumbTarget } from './sidebar-nav.ts'
import { CrumbItemGlyph } from './nav-glyphs.tsx'
import { DataSidebar } from './data-sidebar.tsx'
import { loadActiveViewId, loadViews } from './view-storage.ts'
import { databaseRecordPath, databaseViewPath } from './inspector-nav.ts'
import type { SavedView } from './saved-view.ts'

const DATA_MODULE = { id: 'database', label: '数据', path: '/database' }

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
  const navigate = useNavigate()
  const [hover, setHover] = useState(false)
  useViewTick()
  const collections = (useSnapshot?.((state) => state.collections ?? []) ?? []) as CollectionInfo[]
  const tables = useMemo(
    () => collections.filter((row) => row.path && row.path !== '/'),
    [collections],
  )
  const { crumbs } = crumbsForRoute(location.pathname, tables)
  const leaf = crumbs.at(-1)
  const leafChoice = leaf?.choices.find((item) => item.id === leaf.id)
  const showTrail = hover && crumbs.length > 0

  function go(event: MouseEvent, target: CrumbTarget | { kind: 'root' }) {
    event.preventDefault()
    event.stopPropagation()
    onActivate?.()
    if (target.kind === 'root') {
      navigate(DATABASE_ROOT_PATH)
      return
    }
    navigate(pathForCrumbTarget(target))
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
  const location = useLocation()
  const navigate = useNavigate()
  useViewTick()
  const collections = (useSnapshot((state) => state.collections ?? []) ?? []) as CollectionInfo[]
  const tables = useMemo(
    () => collections.filter((row) => row.path && row.path !== '/'),
    [collections],
  )
  const { collection, viewId } = crumbsForRoute(location.pathname, tables)
  const collectionPath = collection || tables[0]?.path || ''
  const table = tables.find((item) => item.path === collectionPath)
  const views = collectionPath ? loadViews(collectionPath) : []
  const activeViewId = viewId || loadActiveViewId(collectionPath, views)
  const title = table ? tableLabel(table) : '数据'

  function openTable(path: string, nextViewId?: string) {
    navigate(databaseViewPath(path, nextViewId ?? loadActiveViewId(path, loadViews(path)) ?? undefined))
  }

  function applyView(view: SavedView) {
    if (!collectionPath) return
    navigate(databaseViewPath(collectionPath, view.id))
  }

  return (
    <DataSidebar
      hideChrome
      tables={tables}
      collectionPath={collectionPath}
      title={title}
      views={views}
      activeViewId={activeViewId}
      onOpenTable={openTable}
      onApplyView={applyView}
      onRenameView={(view) => window.dispatchEvent(new CustomEvent('fsdb:rename-view', { detail: view }))}
      onDeleteView={(view) => window.dispatchEvent(new CustomEvent('fsdb:delete-view', { detail: view }))}
      onAddView={() => window.dispatchEvent(new Event('fsdb:add-view'))}
      onCopyView={() => window.dispatchEvent(new Event('fsdb:copy-view'))}
      onOpenRecord={(path, view, recordId) => {
        navigate(databaseRecordPath(path, recordId))
      }}
    />
  )
}
