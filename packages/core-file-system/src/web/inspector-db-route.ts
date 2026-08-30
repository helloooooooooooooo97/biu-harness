/** 检查器里每个数据库 Tab 有自己的路径，不改中间主界面。 */

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

export function getInspectorDbPath(paneId = DEFAULT_PANE) {
  return paths.get(paneId) ?? ''
}

export function setInspectorDbPath(paneId: string, next?: string) {
  const id = next === undefined ? DEFAULT_PANE : paneId
  const path = next === undefined ? paneId : next
  if ((paths.get(id) ?? '') === path) return
  if (!path) paths.delete(id)
  else paths.set(id, path)
  bump()
}

export function seedInspectorDbPath(paneId: string, pathname?: string) {
  const id = pathname === undefined ? DEFAULT_PANE : paneId
  const path = pathname === undefined ? paneId : pathname
  if (paths.get(id)) return
  if (!path) return
  paths.set(id, path)
  bump()
}
