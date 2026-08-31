import { builtinAllViewId, stubBuiltinAllView, stubBuiltinCatalogView } from '../catalog-views.ts'
import { normalizeSavedView, type SavedView } from './saved-view.ts'

export function viewsKey(collectionPath: string) {
  return `fsdb.views:${collectionPath}`
}

export function activeViewStorageKey(collectionPath: string) {
  return `fsdb.activeView:${collectionPath}`
}

const memoryViews = new Map<string, SavedView[]>()

export function rememberViews(collectionPath: string, views: SavedView[]) {
  memoryViews.set(collectionPath, views.map((view) => normalizeSavedView(view)))
}

export function loadViews(collectionPath: string): SavedView[] {
  const remembered = memoryViews.get(collectionPath)
  if (remembered?.length) return remembered
  try {
    const raw = localStorage.getItem(viewsKey(collectionPath))
    const parsed = raw ? (JSON.parse(raw) as SavedView[]) : []
    if (parsed.length) return parsed.map((view) => normalizeSavedView(view))
  } catch {
    /* ignore */
  }
  return []
}

export type CrumbRecord = { id: string; label: string; emoji?: string }

const memoryRecords = new Map<string, CrumbRecord[]>()

export function rememberRecords(collectionPath: string, rows: CrumbRecord[]) {
  memoryRecords.set(collectionPath, rows)
}

export function loadRecords(collectionPath: string): CrumbRecord[] {
  return memoryRecords.get(collectionPath) ?? []
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

export function viewForPath(collectionPath: string, routeViewId?: string): SavedView | null {
  const listed = loadViews(collectionPath)
  const fallback = stubBuiltinAllView(builtinAllViewId(collectionPath))
  const preferred =
    (routeViewId
      ? listed.find((item) => item.id === routeViewId) ??
        stubBuiltinCatalogView(routeViewId) ??
        stubBuiltinAllView(routeViewId)
      : undefined) ??
    listed.find((item) => item.id === loadActiveViewId(collectionPath, listed)) ??
    fallback ??
    listed[0]
  return preferred ? normalizeSavedView(preferred) : null
}

export function defaultViewId(collectionPath: string, routeViewId?: string) {
  return viewForPath(collectionPath, routeViewId)?.id ?? builtinAllViewId(collectionPath)
}

export type StarredView = { path: string; viewId: string }

const STARRED_VIEWS_KEY = 'fsdb.starredViews'

export function loadStarredViews(): StarredView[] {
  try {
    const raw = localStorage.getItem(STARRED_VIEWS_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const rec = item as Record<string, unknown>
      const path = String(rec.path ?? '').trim()
      const viewId = String(rec.viewId ?? '').trim()
      return path && viewId ? [{ path, viewId }] : []
    })
  } catch {
    return []
  }
}

let starredViews = loadStarredViews()
let starredVersion = 0
const starredListeners = new Set<() => void>()

export function getStarredViews() {
  return starredViews
}

export function subscribeStarredViews(fn: () => void) {
  starredListeners.add(fn)
  return () => {
    starredListeners.delete(fn)
  }
}

export function getStarredViewsVersion() {
  return starredVersion
}

export function persistStarredViews(items: StarredView[]) {
  starredViews = items
  starredVersion += 1
  localStorage.setItem(STARRED_VIEWS_KEY, JSON.stringify(items))
  for (const fn of starredListeners) fn()
}

export function pushSavedViews(collectionPath: string, views: SavedView[]) {
  void fetch('/api/db/saved-views', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: collectionPath, views }),
  }).catch(() => undefined)
}

export function pushAllSavedViews() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('fsdb.views:')) continue
      const path = key.slice('fsdb.views:'.length)
      const views = loadViews(path)
      if (views.length) pushSavedViews(path, views)
    }
  } catch {
    /* ignore */
  }
}

export function isViewStarred(items: StarredView[], path: string, viewId: string) {
  return items.some((item) => item.path === path && item.viewId === viewId)
}

export function toggleStarredView(items: StarredView[], path: string, viewId: string): StarredView[] {
  if (isViewStarred(items, path, viewId)) return items.filter((item) => item.path !== path || item.viewId !== viewId)
  return [...items, { path, viewId }]
}
