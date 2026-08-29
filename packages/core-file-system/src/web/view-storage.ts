import { normalizeSavedView, type SavedView } from './saved-view.ts'

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

export function loadActiveViewId(collectionPath: string, listed: SavedView[]) {
  try {
    const id = localStorage.getItem(activeViewStorageKey(collectionPath))
    if (id && listed.some((view) => view.id === id)) return id
  } catch {
    /* ignore */
  }
  return listed[0]?.id ?? null
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

export function persistStarredViews(items: StarredView[]) {
  localStorage.setItem(STARRED_VIEWS_KEY, JSON.stringify(items))
}

export function isViewStarred(items: StarredView[], path: string, viewId: string) {
  return items.some((item) => item.path === path && item.viewId === viewId)
}

export function toggleStarredView(items: StarredView[], path: string, viewId: string): StarredView[] {
  if (isViewStarred(items, path, viewId)) return items.filter((item) => item.path !== path || item.viewId !== viewId)
  return [...items, { path, viewId }]
}
