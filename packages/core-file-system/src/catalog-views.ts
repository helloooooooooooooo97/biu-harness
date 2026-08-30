import type { CollectionInfo } from '@biu/type-file-system'
import { normalizeCollectionPath } from './paths.ts'
import { normalizeSavedView, type SavedView } from './web/saved-view.ts'

export function builtinCatalogViewId(collectionPath: string) {
  return `builtin:${normalizeCollectionPath(collectionPath)}`
}

export function isBuiltinCatalogViewId(id: string) {
  return id.startsWith('builtin:')
}

export function builtinCatalogViews(tables: CollectionInfo[]): SavedView[] {
  return tables
    .filter((table) => table.path && table.path !== '/')
    .map((table) => {
      const path = normalizeCollectionPath(table.path)
      return normalizeSavedView({
        id: builtinCatalogViewId(path),
        name: table.view?.title ?? table.label ?? path.replace(/^\//, ''),
        mode: 'table',
        sortField: 'title',
        sortDir: 'asc',
        filters: { tablePath: path },
        columns: [],
        groupBy: '',
        tree: true,
        wrap: false,
        truncate: true,
        query: '',
        builtin: true,
      })
    })
}

export function mergeCatalogViews(tables: CollectionInfo[], user: SavedView[]): SavedView[] {
  const builtins = builtinCatalogViews(tables)
  const extra = user.filter((view) => !view.builtin && !isBuiltinCatalogViewId(view.id))
  return [...builtins, ...extra]
}

/** 路由里已经是 builtin: 时，即使本地还没合并登记表，也能先还原筛选。 */
export function stubBuiltinCatalogView(id: string): SavedView | null {
  if (!isBuiltinCatalogViewId(id)) return null
  const path = normalizeCollectionPath(id.slice('builtin:'.length))
  return normalizeSavedView({
    id: builtinCatalogViewId(path),
    name: path.replace(/^\//, '') || 'views',
    mode: 'table',
    sortField: 'title',
    sortDir: 'asc',
    filters: { tablePath: path },
    columns: [],
    groupBy: '',
    tree: true,
    wrap: false,
    truncate: true,
    query: '',
    builtin: true,
  })
}
