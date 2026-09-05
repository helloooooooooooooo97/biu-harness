import type { InspectorCenterKind } from '@biu/web-session-view'

export type InspectorPanelExtra = {
  centerKinds?: unknown
  requiresSession?: unknown
  common?: unknown
  action?: unknown
  repeatable?: unknown
}

/** 右侧检查器跟当前 Session：页面附加块不进这一栏，但 Session 可以加数据库。 */
export function inspectorPanelMatches(extra: InspectorPanelExtra, sessionId: string | null): boolean {
  if (!sessionId) return false
  const kinds = Array.isArray(extra.centerKinds)
    ? extra.centerKinds.filter((item): item is InspectorCenterKind => typeof item === 'string')
    : []
  if (kinds.length) return kinds.includes('session')
  if (extra.common) return false
  return Boolean(extra.requiresSession)
}

/** 检查器槽位上的元数据不要摊到 React 组件 props 上（Cordis 服务一碰 $$typeof 就会炸）。 */
const INSPECTOR_VIEW_OMIT = new Set([
  'tabId',
  'tabLabel',
  'tabIcon',
  'Tab',
  'centerKinds',
  'common',
  'action',
  'ensureTrajectory',
  'focusOnCall',
  'requiresSession',
  'databaseUi',
  'useSnapshot',
  'slots',
  'repeatable',
])

export function inspectorViewProps(raw: Record<string, unknown>) {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (INSPECTOR_VIEW_OMIT.has(key)) continue
    next[key] = value
  }
  return next
}
export function slotTabId(openedId: string) {
  const split = openedId.indexOf('::')
  return split === -1 ? openedId : openedId.slice(0, split)
}

export function inspectorTabCollectionPath(tabId: string) {
  const slot = slotTabId(tabId)
  return slot.startsWith('database:') ? slot.slice('database:'.length) : null
}

export function pruneOpenedForCollections(opened: string[], collections: Array<{ path: string }> | undefined) {
  if (!collections) return opened
  const live = new Set(collections.map((item) => item.path))
  return opened.filter((id) => {
    const path = inspectorTabCollectionPath(id)
    return !path || live.has(path)
  })
}

export function inspectorTabIsOpen(tabId: string, opened: string[]) {
  return opened.some((id) => slotTabId(id) === tabId)
}

export function nextRepeatableTabId(tabId: string) {
  return `${tabId}::${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function resolveInspectorTab(current: string, allowed: string[], opened: string[] = []) {
  const hanging = opened.filter((id) => allowed.includes(id) || allowed.includes(slotTabId(id)))
  if (current && hanging.includes(current)) return current
  const currentSlot = current ? slotTabId(current) : ''
  const bySlot = currentSlot ? hanging.find((id) => slotTabId(id) === currentSlot) : undefined
  if (bySlot) return bySlot
  return hanging[0] ?? ''
}
