import type { InspectorCenterKind } from '@biu/web-session-view'

export type InspectorPanelExtra = {
  centerKinds?: unknown
  requiresSession?: unknown
}

export function inspectorPanelMatches(
  extra: InspectorPanelExtra,
  centerKind: InspectorCenterKind,
  sessionId: string | null,
): boolean {
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

/** 不自动打开任何分区：只有用户点过、且该项仍可用时才保持。 */
export function resolveInspectorTab(current: string, allowed: string[]) {
  if (current && allowed.includes(current)) return current
  return ''
}
