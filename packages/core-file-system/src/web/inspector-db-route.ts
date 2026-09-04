/** 检查器里每个数据库 Tab 有自己的路径，不改中间主界面。 */

import { normalizeCollectionPath } from '../paths.ts'
import { DATA_MODULE_PATH, databaseAllViewPath, databaseRecordPath, databaseViewPath } from './database-path.ts'
import { upsertSavedView } from './view-storage.ts'
import { normalizeSavedView, type SavedView } from './saved-view.ts'

const DEFAULT_PANE = 'database'
const STORAGE_PREFIX = 'inspector.dbPath:'
const listeners = new Set<() => void>()
const paths = new Map<string, string>()
const working = new Set<string>()
const workingListeners = new Set<() => void>()

function storageKey(paneId: string) {
  return `${STORAGE_PREFIX}${paneId}`
}

function slotTabId(openedId: string) {
  const split = openedId.indexOf('::')
  return split === -1 ? openedId : openedId.slice(0, split)
}

function paneIdsForTab(tabId: string) {
  const ids = new Set<string>([tabId])
  for (const id of paths.keys()) {
    if (id === tabId || slotTabId(id) === tabId) ids.add(id)
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? ''
      if (!key.startsWith(STORAGE_PREFIX)) continue
      const id = key.slice(STORAGE_PREFIX.length)
      if (id === tabId || slotTabId(id) === tabId) ids.add(id)
    }
  } catch {
    /* ignore */
  }
  return [...ids]
}

function readStoredPath(paneId: string) {
  try {
    const raw = localStorage.getItem(storageKey(paneId)) ?? ''
    return isInspectorDatabasePath(raw) ? raw : ''
  } catch {
    return ''
  }
}

function writeStoredPath(paneId: string, path: string) {
  try {
    if (!path) localStorage.removeItem(storageKey(paneId))
    else localStorage.setItem(storageKey(paneId), path)
  } catch {
    /* ignore */
  }
}

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
  const mem = paths.get(paneId)
  if (mem !== undefined) return isInspectorDatabasePath(mem) ? mem : ''
  const stored = readStoredPath(paneId)
  if (stored) paths.set(paneId, stored)
  return stored
}

export function getInspectorDbPath(paneId = DEFAULT_PANE) {
  return panePath(paneId)
}

/** 测试用：清空内存路径，模拟整页刷新后只剩 localStorage。 */
export function resetInspectorDbPathMemory() {
  paths.clear()
}

export function setInspectorDbPath(paneId: string, next?: string) {
  const id = next === undefined ? DEFAULT_PANE : paneId
  const path = next === undefined ? paneId : next
  const stored = isInspectorDatabasePath(path) ? path : ''
  if ((paths.get(id) ?? '') === stored) {
    writeStoredPath(id, stored)
    return
  }
  if (!stored) paths.delete(id)
  else paths.set(id, stored)
  writeStoredPath(id, stored)
  bump()
}

export function inspectorCollectionTabId(collection: string) {
  return `database:${collection}`
}

/** 右侧检查器打开这条路径，中间主界面不动。已打开的同表实例（含 :: 副本）一起改路径。 */
export function showInInspector(collection: string, href: string) {
  const tabId = inspectorCollectionTabId(collection)
  for (const paneId of paneIdsForTab(tabId)) setInspectorDbPath(paneId, href)
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
