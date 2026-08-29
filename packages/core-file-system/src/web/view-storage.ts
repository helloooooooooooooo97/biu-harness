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

const STARRED_TABLES_KEY = 'fsdb.starredTables'

export function loadStarredTables(): string[] {
  try {
    const raw = localStorage.getItem(STARRED_TABLES_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : []
  } catch {
    return []
  }
}

export function persistStarredTables(paths: string[]) {
  localStorage.setItem(STARRED_TABLES_KEY, JSON.stringify(paths))
}

export function toggleStarredTable(paths: string[], path: string) {
  return paths.includes(path) ? paths.filter((item) => item !== path) : [...paths, path]
}
