import type { CollectionInfo, DbRecord } from '@biu/type-file-system'
import type { CollectionChrome } from '@biu/type-file-system/ui'
import { catalogRowOpenTarget, mergeCatalogViews } from '../catalog-views.ts'
import { viewsCatalogSource } from './database-path.ts'
import type { SavedView } from './saved-view.ts'

export const viewsChrome: CollectionChrome = {
  openRow(row: DbRecord) {
    const target = catalogRowOpenTarget({ tablePath: row.tablePath, viewId: row.viewId })
    if (!target) return null
    return { kind: 'table', path: target.collection, viewId: target.viewId }
  },
  lockedFiltersFromSearch(search: string) {
    const source = viewsCatalogSource(search)
    return source ? { tablePath: source } : ({} as Record<string, string>)
  },
  listViews(tables: CollectionInfo[], user: unknown[]) {
    return mergeCatalogViews(tables, user as SavedView[])
  },
}
