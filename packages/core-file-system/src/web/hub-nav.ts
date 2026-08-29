import type { CollectionInfo } from '@biu/type-file-system'

export function normalizeNavPath(path: string) {
  const raw = String(path || '/').trim() || '/'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  if (withSlash === '/') return '/'
  return withSlash.replace(/\/+$/, '') || '/'
}

export function navCollections(rows: CollectionInfo[]) {
  return rows
    .filter((row) => row.view?.moduleId && row.view.route)
    .slice()
    .sort((a, b) => (a.view!.order ?? 50) - (b.view!.order ?? 50) || a.path.localeCompare(b.path))
}

export function collectionFromLocation(rows: CollectionInfo[], pathname: string): CollectionInfo | undefined {
  const listed = navCollections(rows)
  const path = normalizeNavPath(pathname)
  return (
    listed.find((row) => {
      const route = normalizeNavPath(row.view!.route)
      return path === route || path.startsWith(`${route}/`)
    }) ?? listed[0]
  )
}

export const DATABASE_MODULE_ID = 'database'
export const DATABASE_MODULE_PATH = '/database'

let liveNavCollections: CollectionInfo[] = []
const liveListeners = new Set<() => void>()

export function setLiveNavCollections(next: CollectionInfo[]) {
  liveNavCollections = next
  for (const fn of liveListeners) fn()
}

export function subscribeLiveNavCollections(fn: () => void) {
  liveListeners.add(fn)
  return () => liveListeners.delete(fn)
}

export function getLiveNavCollections() {
  return liveNavCollections
}
