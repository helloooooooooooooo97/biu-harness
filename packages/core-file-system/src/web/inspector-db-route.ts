/** 检查器里每个数据库 Tab 有自己的路径，不改中间主界面。 */

import { normalizeCollectionPath } from '../paths.ts'
import { DATA_MODULE_PATH, databaseAllViewPath, databaseRecordPath } from './database-path.ts'

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
  showInInspector(collection, databaseAllViewPath(collection))
}

/** Agent 工具推送：先切过去并标成干活中，完成后停 busy。中间主界面不动。 */
export function applyDatabaseChannelPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return
  const reveal = (payload as { reveal?: unknown }).reveal
  if (!reveal || typeof reveal !== 'object' || Array.isArray(reveal)) return
  const collection = normalizeCollectionPath(String((reveal as { collection?: unknown }).collection ?? ''))
  if (!collection || collection === '/') return
  const phase = String((payload as { phase?: unknown }).phase ?? '')
  applyDatabaseReveal(reveal)
  setInspectorAgentWorking(collection, phase !== 'done')
}

export function seedInspectorDbPath(paneId: string, pathname?: string) {
  const id = pathname === undefined ? DEFAULT_PANE : paneId
  const path = pathname === undefined ? paneId : pathname
  if (panePath(id)) return
  if (!isInspectorDatabasePath(path)) return
  paths.set(id, path)
  bump()
}
