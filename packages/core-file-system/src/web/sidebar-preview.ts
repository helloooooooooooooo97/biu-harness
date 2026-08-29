import type { DbRecord } from '@biu/type-file-system'
import type { SavedView } from './saved-view.ts'

export const SIDEBAR_PREVIEW_PAGE = 20
export const SIDEBAR_PREVIEW_MAX = 100

export type PreviewPage = {
  items: DbRecord[]
  total: number
}

export function previewCacheKey(path: string, view: Pick<SavedView, 'id' | 'sortField' | 'sortDir' | 'filters' | 'query'>) {
  return `${path}\0${view.id}\0${view.sortField}\0${view.sortDir}\0${JSON.stringify(view.filters ?? {})}\0${view.query ?? ''}`
}

export function recordPreviewLabel(row: DbRecord, labelField?: string) {
  if (labelField) {
    const labeled = row[labelField]
    if (labeled != null && String(labeled).trim()) return String(labeled)
  }
  for (const key of ['title', 'name', 'label']) {
    const value = row[key]
    if (value != null && String(value).trim()) return String(value)
  }
  return String(row.id)
}

export function nextPreviewLimit(loaded: number, total: number) {
  if (loaded >= total) return 0
  return Math.min(SIDEBAR_PREVIEW_PAGE, SIDEBAR_PREVIEW_MAX - loaded, total - loaded)
}

export const TABLE_TOTAL_VIEW = {
  id: '__table__',
  sortField: 'id',
  sortDir: 'asc' as const,
  filters: {} as Record<string, string>,
  query: '',
}

const totalCache = new Map<string, number>()
const totalListeners = new Set<() => void>()
let totalsVersion = 0

export function rememberPreviewTotal(key: string, total: number) {
  if (totalCache.get(key) === total) return
  totalCache.set(key, total)
  totalsVersion += 1
  for (const fn of totalListeners) fn()
}

export function getPreviewTotalsVersion() {
  return totalsVersion
}

export function getPreviewTotal(key: string) {
  return totalCache.get(key)
}

export function subscribePreviewTotals(fn: () => void) {
  totalListeners.add(fn)
  return () => {
    totalListeners.delete(fn)
  }
}

export function viewTotalKey(path: string, view: Pick<SavedView, 'id' | 'sortField' | 'sortDir' | 'filters' | 'query'>) {
  return previewCacheKey(path, view)
}

export function tableTotalKey(path: string) {
  return previewCacheKey(path, TABLE_TOTAL_VIEW)
}

export async function fetchViewTotal(
  path: string,
  view: Pick<SavedView, 'id' | 'sortField' | 'sortDir' | 'filters' | 'query'>,
) {
  const key = viewTotalKey(path, view)
  const cached = totalCache.get(key)
  if (cached != null) return cached
  const page = await fetchViewPreview(path, view, 0, 1)
  rememberPreviewTotal(key, page.total)
  return page.total
}

export async function fetchViewPreview(
  path: string,
  view: Pick<SavedView, 'sortField' | 'sortDir' | 'filters' | 'query'>,
  offset: number,
  limit = SIDEBAR_PREVIEW_PAGE,
): Promise<PreviewPage> {
  const params = new URLSearchParams({
    path,
    limit: String(Math.max(1, Math.min(limit, SIDEBAR_PREVIEW_PAGE))),
    offset: String(Math.max(0, offset)),
    q: view.query ?? '',
    sort: view.sortField || 'id',
    dir: view.sortDir === 'desc' ? 'desc' : 'asc',
    filter: JSON.stringify(view.filters ?? {}),
  })
  const res = await fetch(`/api/db/list?${params}`)
  const body = (await res.json()) as PreviewPage & { error?: string }
  if (!res.ok) throw new Error(body.error || res.statusText)
  return {
    items: Array.isArray(body.items) ? body.items : [],
    total: typeof body.total === 'number' ? body.total : (body.items?.length ?? 0),
  }
}
