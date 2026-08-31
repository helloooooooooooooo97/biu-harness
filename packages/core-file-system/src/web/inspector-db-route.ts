/** 检查器里每个数据库 Tab 有自己的路径，不改中间主界面。 */

import { DATA_MODULE_PATH, databaseRecordPath } from './database-path.ts'

const DEFAULT_PANE = 'database'
const listeners = new Set<() => void>()
const paths = new Map<string, string>()

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

/** 右侧检查器打开这条记录，中间主界面不动。 */
export function showRecordInInspector(collection: string, recordId: string) {
  const tabId = inspectorCollectionTabId(collection)
  setInspectorDbPath(tabId, databaseRecordPath(collection, recordId))
  window.dispatchEvent(new Event('biu:inspector-open'))
  window.dispatchEvent(new CustomEvent('biu:inspector-tab', { detail: tabId }))
}

export function seedInspectorDbPath(paneId: string, pathname?: string) {
  const id = pathname === undefined ? DEFAULT_PANE : paneId
  const path = pathname === undefined ? paneId : pathname
  if (panePath(id)) return
  if (!isInspectorDatabasePath(path)) return
  paths.set(id, path)
  bump()
}
