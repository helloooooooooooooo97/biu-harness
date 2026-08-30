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
])

export function inspectorViewProps(raw: Record<string, unknown>) {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (INSPECTOR_VIEW_OMIT.has(key)) continue
    next[key] = value
  }
  return next
}
export function resolveInspectorTab(current: string, allowed: string[]) {
  if (current && allowed.includes(current)) return current
  return ''
}
