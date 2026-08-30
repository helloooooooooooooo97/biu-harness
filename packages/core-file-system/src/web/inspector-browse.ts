import type { CrumbTarget } from './sidebar-nav.ts'

export type InspectorBrowse = {
  collection: string
  viewId?: string
  recordId?: string
}

export function emptyInspectorBrowse(): InspectorBrowse {
  return { collection: '' }
}

export function applyInspectorBrowse(
  current: InspectorBrowse,
  target: CrumbTarget | { kind: 'root' },
): InspectorBrowse {
  if (target.kind === 'root') return emptyInspectorBrowse()
  if (target.kind === 'collection') return { collection: target.collection }
  if (target.kind === 'view') return { collection: target.collection, viewId: target.viewId }
  return { collection: target.collection, viewId: current.viewId, recordId: target.recordId }
}
