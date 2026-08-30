/** 检查器里的数据库页有自己的路径，不改中间主界面。 */

const listeners = new Set<() => void>()
let current = ''

export function subscribeInspectorDbPath(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function getInspectorDbPath() {
  return current
}

export function setInspectorDbPath(next: string) {
  if (current === next) return
  current = next
  for (const fn of listeners) fn()
}

export function seedInspectorDbPath(pathname: string) {
  if (current) return
  if (!pathname) return
  current = pathname
  for (const fn of listeners) fn()
}
