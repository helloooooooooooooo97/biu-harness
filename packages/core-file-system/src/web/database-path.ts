import { buildAppPath, type AppRoute } from '@biu/web-session-view'
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

export function viewsCatalogHref(sourcePath: string, viewId?: string): string {
  const base = databaseViewPath(VIEWS_COLLECTION_PATH, viewId)
  const source = normalizeCollectionPath(sourcePath)
  if (!source || source === VIEWS_COLLECTION_PATH) return base
  return `${base}?source=${encodeURIComponent(source)}`
}

export function viewsCatalogSource(search: string): string {
  const raw = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('source')
  return raw ? normalizeCollectionPath(raw) : ''
}
