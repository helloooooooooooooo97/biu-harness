import type { InspectorCenterKind } from '@biu/web-session-view'

export type InspectorPanelExtra = {
  centerKinds?: unknown
  requiresSession?: unknown
  common?: unknown
  action?: unknown
}

export function inspectorPanelMatches(
  extra: InspectorPanelExtra,
  centerKind: InspectorCenterKind,
  sessionId: string | null,
): boolean {
  if (extra.common) {
    if (extra.requiresSession && !sessionId) return false
    return true
  }
  const kinds = Array.isArray(extra.centerKinds)
    ? extra.centerKinds.filter((item): item is InspectorCenterKind => typeof item === 'string')
    : []
  if (kinds.length) {
    if (!kinds.includes(centerKind)) return false
  } else if (extra.requiresSession) {
    if (centerKind !== 'session') return false
  } else if (centerKind === 'session' || centerKind === 'collection-view' || centerKind === 'record') {
    return false
  }
  if (extra.requiresSession && !sessionId) return false
  return true
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
  'sessionView',
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
