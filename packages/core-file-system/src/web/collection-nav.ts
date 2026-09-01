import type { CollectionInfo, DbRecord } from '@biu/type-file-system'
import { catalogRowOpenTarget, mergeViewsForPath, stampRowOpenTarget, tagRowOpenTarget } from '../catalog-views.ts'
import { SUPERTAGS_COLLECTION_PATH, VIEWS_COLLECTION_PATH } from './database-path.ts'
import type { SavedView } from './saved-view.ts'
import { loadSchemaTags } from './schema-tags.ts'

/** 视图目录、标签收集等：点一行时跳到别处，而不是打开本表记录。 */
export function openRegisteredRow(
  collectionPath: string,
  row: DbRecord,
  go: {
    table: (path: string, viewId?: string) => void
    record: (recordId: string, collection?: string) => void
  },
) {
  if (collectionPath === VIEWS_COLLECTION_PATH) {
    const target = catalogRowOpenTarget(row)
    if (!target) return false
    go.table(target.collection, target.viewId)
    return true
  }
  if (collectionPath === SUPERTAGS_COLLECTION_PATH) {
    const stamp = stampRowOpenTarget(row)
    if (stamp) {
      go.record(stamp.recordId, stamp.collection)
      return true
    }
    const tag = tagRowOpenTarget(row)
    if (!tag) return false
    go.table(collectionPath, tag.viewId)
    return true
  }
  return false
}

export function viewsForRegisteredCollection(
  path: string,
  tables: CollectionInfo[],
  user: SavedView[],
) {
  const table = tables.find((item) => item.path === path) ?? { path, label: path.replace(/^\//, '') }
  return mergeViewsForPath(path, table, tables, user, loadSchemaTags())
}
