import { useEffect, useMemo, useState } from 'react'
import { CircleStackIcon, Squares2X2Icon, TableCellsIcon, DocumentTextIcon } from '@heroicons/react/16/solid'
import type { SlotProps } from '@biu/type-slots'
import type { CollectionInfo } from '@biu/type-file-system'
import type { bindSnapshot } from '@biu/web-snapshot'
import { buildCrumbs, type CrumbTarget } from './sidebar-nav.ts'
import { applyInspectorBrowse, emptyInspectorBrowse } from './inspector-browse.ts'
import { loadViews } from './view-storage.ts'
import { fetchViewPreview, recordPreviewLabel } from './sidebar-preview.ts'

function tableLabel(table: CollectionInfo) {
  return table.view?.title ?? table.label ?? table.path.replace(/^\//, '')
}

export function DatabaseInspectorBrowse(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const collections = (useSnapshot((state) => state.collections ?? []) ?? []) as CollectionInfo[]
  const tables = useMemo(
    () => collections.filter((row) => row.path && row.path !== '/'),
    [collections],
  )
  const [browse, setBrowse] = useState(emptyInspectorBrowse)
  const [records, setRecords] = useState<Array<{ id: string; label: string }>>([])
  const table = tables.find((item) => item.path === browse.collection)
  const views = browse.collection ? loadViews(browse.collection) : []
  const view = views.find((item) => item.id === browse.viewId)
  const crumbs = buildCrumbs({
    collection: browse.collection,
    collectionLabel: table ? tableLabel(table) : browse.collection,
    tables: tables.map((item) => ({ path: item.path, label: tableLabel(item) })),
    viewId: browse.viewId,
    viewName: view?.name,
    views: views.map((item) => ({ id: item.id, name: item.name })),
    recordId: browse.recordId,
    recordLabel: records.find((row) => row.id === browse.recordId)?.label,
    records,
  })

  useEffect(() => {
    const current = browse.collection && browse.viewId
      ? loadViews(browse.collection).find((item) => item.id === browse.viewId)
      : undefined
    if (!browse.collection || !current) {
      setRecords([])
      return
    }
    let cancelled = false
    void fetchViewPreview(browse.collection, current, 0, 40).then((page) => {
      if (cancelled) return
      const labelField = undefined
      setRecords(page.items.map((row) => ({ id: String(row.id), label: recordPreviewLabel(row, labelField) })))
    }).catch(() => {
      if (!cancelled) setRecords([])
    })
    return () => {
      cancelled = true
    }
  }, [browse.collection, browse.viewId])

  function go(target: CrumbTarget | { kind: 'root' }) {
    setBrowse((prev) => applyInspectorBrowse(prev, target))
  }

  const list = !browse.collection
    ? tables.map((item) => ({
        id: item.path,
        label: tableLabel(item),
        Icon: TableCellsIcon,
        onClick: () => go({ kind: 'collection', collection: item.path }),
      }))
    : !browse.viewId
      ? views.map((item) => ({
          id: item.id,
          label: item.name,
          Icon: Squares2X2Icon,
          onClick: () => go({ kind: 'view', collection: browse.collection, viewId: item.id }),
        }))
      : !browse.recordId
        ? records.map((item) => ({
            id: item.id,
            label: item.label,
            Icon: DocumentTextIcon,
            onClick: () => go({ kind: 'record', collection: browse.collection, recordId: item.id }),
          }))
        : []

  return (
    <div className="inspector-catalog" data-testid="inspector-database">
      <nav className="fsdb-crumbs" aria-label="数据库位置">
        <span className="fsdb-crumb">
          <button type="button" className="fsdb-crumb-btn" onClick={() => go({ kind: 'root' })}>
            <CircleStackIcon aria-hidden className="chat-view-project-icon" />
            <span className="chat-view-project-name">数据库</span>
          </button>
        </span>
        {crumbs.map((crumb) => (
          <span key={crumb.id} className="fsdb-crumb">
            <span className="fsdb-crumb-sep" aria-hidden>/</span>
            <button type="button" className="fsdb-crumb-btn" onClick={() => go(crumb.target)}>
              <span className="chat-view-project-name">{crumb.label}</span>
            </button>
          </span>
        ))}
      </nav>
      {list.length ? (
        list.map((item) => (
          <button
            key={item.id}
            type="button"
            className="inspector-catalog-item"
            onClick={item.onClick}
          >
            <item.Icon aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          </button>
        ))
      ) : (
        <p className="inspector-catalog-empty">
          {browse.recordId ? records.find((row) => row.id === browse.recordId)?.label || browse.recordId : '没有可打开的项'}
        </p>
      )}
    </div>
  )
}
