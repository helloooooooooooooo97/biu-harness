import { buildAppPath, type AppRoute } from '@biu/web-session-view'
import { builtinCatalogViewId } from '../catalog-views.ts'
import { normalizeCollectionPath } from '../paths.ts'

export const DATA_MODULE_ID = 'database'
export const DATA_MODULE_PATH = '/database'
export const DATA_MODULE = { id: DATA_MODULE_ID, label: '数据', path: DATA_MODULE_PATH }

const ROUTE = { moduleId: DATA_MODULE_ID, path: DATA_MODULE_PATH } as const

export function databaseViewPath(collection: string, viewId?: string): string {
  return buildAppPath({
    kind: 'collection-view',
    ...ROUTE,
    collection,
    viewId,
  })
}

export function databaseRecordPath(collection: string, recordId: string): string {
  return buildAppPath({
    kind: 'record',
    ...ROUTE,
    collection,
    recordId,
  } satisfies AppRoute)
}

export const VIEWS_COLLECTION_PATH = '/views'

/** 表路径且没有 view/record：中间列出该表下的视图，路由仍是 /database/:table。 */
export function isCollectionHub(collection: string, viewId?: string, recordId?: string | null) {
  return Boolean(collection) && collection !== VIEWS_COLLECTION_PATH && !viewId && !recordId
}

export function viewsCatalogHref(sourcePath: string): string {
  const source = normalizeCollectionPath(sourcePath)
  const viewId = builtinCatalogViewId(source || VIEWS_COLLECTION_PATH)
  const base = databaseViewPath(VIEWS_COLLECTION_PATH, viewId)
  if (!source || source === VIEWS_COLLECTION_PATH) return base
  return `${base}?source=${encodeURIComponent(source)}`
}

export function viewsCatalogSource(search: string): string {
  const raw = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('source')
  return raw ? normalizeCollectionPath(raw) : ''
}
