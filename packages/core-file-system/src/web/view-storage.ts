import { builtinAllViewId, stubBuiltinAllView, stubBuiltinCatalogView, stubBuiltinTagView } from '../catalog-views.ts'
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

export type CrumbRecord = { id: string; label: string; emoji?: string; mascot?: unknown }

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
        stubBuiltinTagView(routeViewId) ??
        stubBuiltinAllView(routeViewId)
      : undefined) ??
    listed.find((item) => item.id === loadActiveViewId(collectionPath, listed)) ??
    fallback ??
    listed[0]
  return preferred ? withViewDisplay(collectionPath, normalizeSavedView(preferred)) : null
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

const DISPLAY_KEYS = [
  'mode',
  'sortField',
  'sortDir',
  'columns',
  'groupBy',
  'tree',
  'wrap',
  'truncate',
  'query',
  'pageSize',
] as const

export type ViewDisplayPatch = Partial<Pick<SavedView, (typeof DISPLAY_KEYS)[number]>>

export function viewDisplayKey(collectionPath: string, viewId: string) {
  return `fsdb.viewDisplay:${collectionPath}:${viewId}`
}

function pickDisplay(patch: Partial<SavedView>): ViewDisplayPatch {
  const next: ViewDisplayPatch = {}
  for (const key of DISPLAY_KEYS) {
    if (patch[key] !== undefined) (next as Record<string, unknown>)[key] = patch[key]
  }
  return next
}

export function loadViewDisplay(collectionPath: string, viewId: string): ViewDisplayPatch {
  try {
    const raw = localStorage.getItem(viewDisplayKey(collectionPath, viewId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return {}
    return pickDisplay(parsed)
  } catch {
    return {}
  }
}

export function persistViewDisplay(collectionPath: string, viewId: string, patch: Partial<SavedView>) {
  try {
    const next = { ...loadViewDisplay(collectionPath, viewId), ...pickDisplay(patch) }
    localStorage.setItem(viewDisplayKey(collectionPath, viewId), JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

/** 内置「全部 xx」不能当用户视图存整份，显示项（换行等）单独记。 */
export function withViewDisplay(collectionPath: string, view: SavedView): SavedView {
  const overlay = loadViewDisplay(collectionPath, view.id)
  if (!Object.keys(overlay).length) return normalizeSavedView(view)
  return normalizeSavedView({
    ...view,
    ...overlay,
    id: view.id,
    name: view.name,
    builtin: view.builtin,
    filters: view.filters,
  })
}
