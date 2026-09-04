/** 检查器里每个数据库 Tab 有自己的路径，不改中间主界面。 */

import { normalizeCollectionPath } from '../paths.ts'
import { DATA_MODULE_PATH, databaseAllViewPath, databaseRecordPath, databaseViewPath } from './database-path.ts'
import { upsertSavedView } from './view-storage.ts'
import { normalizeSavedView, type SavedView } from './saved-view.ts'

const DEFAULT_PANE = 'database'
const listeners = new Set<() => void>()
const paths = new Map<string, string>()
const working = new Set<string>()
const workingListeners = new Set<() => void>()

export function subscribeInspectorAgentWorking(fn: () => void) {
  workingListeners.add(fn)
  return () => {
    workingListeners.delete(fn)
  }
}

function bumpWorking() {
  for (const fn of workingListeners) fn()
}

export function isInspectorAgentWorking(collection: string) {
  return working.has(normalizeCollectionPath(collection))
}

export function setInspectorAgentWorking(collection: string, next: boolean) {
  const path = normalizeCollectionPath(collection)
  if (!path || path === '/') return
  const had = working.has(path)
  if (next && !had) {
    working.add(path)
    bumpWorking()
    return
  }
  if (!next && had) {
    working.delete(path)
    bumpWorking()
  }
}

export function subscribeInspectorDbPath(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function bump() {
  for (const fn of listeners) fn()
}

export function isInspectorDatabasePath(pathname: string) {
  const path = String(pathname || '').split('?')[0]
  return path === DATA_MODULE_PATH || path.startsWith(`${DATA_MODULE_PATH}/`)
}

function panePath(paneId = DEFAULT_PANE) {
  const path = paths.get(paneId) ?? ''
  return isInspectorDatabasePath(path) ? path : ''
}

export function getInspectorDbPath(paneId = DEFAULT_PANE) {
  return panePath(paneId)
}

export function setInspectorDbPath(paneId: string, next?: string) {
  const id = next === undefined ? DEFAULT_PANE : paneId
  const path = next === undefined ? paneId : next
  const stored = isInspectorDatabasePath(path) ? path : ''
  if ((paths.get(id) ?? '') === stored) return
  if (!stored) paths.delete(id)
  else paths.set(id, stored)
  bump()
}

export function inspectorCollectionTabId(collection: string) {
  return `database:${collection}`
}

/** 右侧检查器打开这条路径，中间主界面不动。 */
export function showInInspector(collection: string, href: string) {
  const tabId = inspectorCollectionTabId(collection)
  setInspectorDbPath(tabId, href)
  window.dispatchEvent(new Event('biu:inspector-open'))
  window.dispatchEvent(new CustomEvent('biu:inspector-tab', { detail: tabId }))
}

/** 右侧检查器打开这条记录，中间主界面不动。 */
export function showRecordInInspector(collection: string, recordId: string) {
  showInInspector(collection, databaseRecordPath(collection, recordId))
}

/** 工具查/改/删某张表后：打开右侧检查器并切到该表（中间主界面不动）。 */
export function applyDatabaseReveal(reveal: unknown) {
  if (!reveal || typeof reveal !== 'object' || Array.isArray(reveal)) return
  const collection = normalizeCollectionPath(String((reveal as { collection?: unknown }).collection ?? ''))
  if (!collection || collection === '/') return
  const recordId = String((reveal as { recordId?: unknown }).recordId ?? '').trim()
  if (recordId) {
    showRecordInInspector(collection, recordId)
    return
  }
  const viewId = String((reveal as { viewId?: unknown }).viewId ?? '').trim()
  if (viewId) {
    showInInspector(collection, databaseViewPath(collection, viewId))
    return
  }
  showInInspector(collection, databaseAllViewPath(collection))
}

/** Agent 工具推送：只跟当前主 Session。表格刷新仍走 fsdb:change。 */
export function applyDatabaseChannelPayload(payload: unknown, currentSessionId?: string | null) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return
  const sessionId = String((payload as { sessionId?: unknown }).sessionId ?? '').trim()
  if (!sessionId || !currentSessionId || sessionId !== String(currentSessionId)) return
  const reveal = (payload as { reveal?: unknown }).reveal
  if (!reveal || typeof reveal !== 'object' || Array.isArray(reveal)) return
  const collection = normalizeCollectionPath(String((reveal as { collection?: unknown }).collection ?? ''))
  if (!collection || collection === '/') return
  const savedView = savedViewFromPayload((payload as { savedView?: unknown }).savedView, (reveal as { viewId?: unknown }).viewId)
  if (savedView) upsertSavedView(collection, savedView)
  const phase = String((payload as { phase?: unknown }).phase ?? '')
  applyDatabaseReveal(reveal)
  setInspectorAgentWorking(collection, phase !== 'done')
}

function savedViewFromPayload(raw: unknown, revealViewId: unknown): SavedView | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>
  const id = String(rec.id ?? revealViewId ?? '').trim()
  if (!id) return null
  let filters: Record<string, string> = {}
  if (rec.filters && typeof rec.filters === 'object' && !Array.isArray(rec.filters)) {
    filters = Object.fromEntries(Object.entries(rec.filters).map(([key, item]) => [key, String(item)]))
  }
  return normalizeSavedView({
    id,
    name: String(rec.name ?? rec.title ?? '新视图'),
    mode: rec.mode as SavedView['mode'],
    sortField: String(rec.sortField ?? 'id'),
    sortDir: rec.sortDir === 'desc' ? 'desc' : 'asc',
    filters,
    columns: Array.isArray(rec.columns) ? rec.columns.map((item) => String(item)) : [],
    groupBy: String(rec.groupBy ?? ''),
    tree: rec.tree !== false,
    wrap: Boolean(rec.wrap),
    truncate: rec.truncate !== false,
    query: String(rec.query ?? ''),
    pageSize: Number(rec.pageSize) || 50,
    builtin: false,
  })
}

export const INSPECTOR_REVEAL_EVENT = 'biu:inspector-reveal'

function onInspectorReveal(event: Event) {
  applyDatabaseReveal((event as CustomEvent).detail)
}

if (typeof window !== 'undefined') {
  window.addEventListener(INSPECTOR_REVEAL_EVENT, onInspectorReveal)
}
