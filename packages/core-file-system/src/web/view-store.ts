import { normalizeSavedView, type SavedView } from './saved-view.ts'

export const VIEWS_EVENT = 'fsdb:views'

export function viewsKey(collectionPath: string) {
  return `fsdb.views:${collectionPath}`
}

export function activeViewStorageKey(collectionPath: string) {
  return `fsdb.activeView:${collectionPath}`
}

export function loadViews(collectionPath: string): SavedView[] {
  try {
    const raw = localStorage.getItem(viewsKey(collectionPath))
    const parsed = raw ? (JSON.parse(raw) as SavedView[]) : []
    return parsed.map((view) => normalizeSavedView(view))
  } catch {
    return []
  }
}

export function persistViews(collectionPath: string, next: SavedView[]) {
  localStorage.setItem(viewsKey(collectionPath), JSON.stringify(next))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VIEWS_EVENT, { detail: { path: collectionPath } }))
  }
}

export function loadActiveViewId(collectionPath: string, listed: SavedView[]) {
  try {
    const id = localStorage.getItem(activeViewStorageKey(collectionPath))
    if (id && listed.some((view) => view.id === id)) return id
  } catch {
    /* ignore */
  }
  return listed[0]?.id ?? null
}

export function rememberActiveView(collectionPath: string, id: string) {
  try {
    localStorage.setItem(activeViewStorageKey(collectionPath), id)
  } catch {
    /* ignore */
  }
}

export function defaultViewStub(id = `${Date.now()}`): SavedView {
  return normalizeSavedView({
    id,
    name: '默认视图',
    mode: 'table',
    sortField: 'id',
    sortDir: 'asc',
    filters: {},
    columns: [],
    groupBy: '',
    tree: true,
    wrap: false,
    truncate: true,
    query: '',
  })
}

export function ensureViews(collectionPath: string): SavedView[] {
  const listed = loadViews(collectionPath)
  if (listed.length) return listed
  const next = [defaultViewStub(`${Date.now()}:${collectionPath}`)]
  persistViews(collectionPath, next)
  return next
}

export function viewCount(collectionPath: string) {
  return ensureViews(collectionPath).length
}
