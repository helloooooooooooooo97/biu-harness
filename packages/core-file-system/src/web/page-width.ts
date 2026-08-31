export type PageWidth = 'max' | 'full'

const KEY = 'fsdb.pageWidth'

function readPageWidth(): PageWidth {
  try {
    return localStorage.getItem(KEY) === 'full' ? 'full' : 'max'
  } catch {
    return 'max'
  }
}

let pageWidth: PageWidth = readPageWidth()
let pageWidthVersion = 0
const listeners = new Set<() => void>()

export function getPageWidth() {
  return pageWidth
}

export function getPageWidthVersion() {
  return pageWidthVersion
}

export function subscribePageWidth(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function persistPageWidth(next: PageWidth) {
  if (next === pageWidth) return
  pageWidth = next
  pageWidthVersion += 1
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* ignore */
  }
  for (const fn of listeners) fn()
}
