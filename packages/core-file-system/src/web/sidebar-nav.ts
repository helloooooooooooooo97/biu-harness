/** 侧栏展开/收起与数据路由切换的纯逻辑，UI 和压测共用。 */
import { parseAppPath } from '@biu/web-session-view'
import { databaseRecordPath, databaseViewPath } from './inspector-nav.ts'

const DATABASE = [{ id: 'database', label: '数据', path: '/database' }]

export type DataCenter = {
  collection: string
  viewId?: string
  recordId?: string
  lastViewId?: string
}

export type SidebarChrome = {
  viewsOpen: boolean
  expandedViewKey: string | null
  openTables: Record<string, boolean>
}

export type SidebarNavState = DataCenter & SidebarChrome

export type SidebarNavAction =
  | { type: 'toggle-preview'; key: string }
  | { type: 'toggle-sidebar' }
  | { type: 'toggle-table'; path: string }
  | { type: 'open-view'; path: string; viewId: string }
  | { type: 'open-record'; path: string; viewId: string; recordId: string }
  | { type: 'close-record' }
  | { type: 'open-table'; path: string; viewId?: string }

export function previewKey(path: string, viewId: string) {
  return `${path}:${viewId}`
}

export function starPreviewKey(path: string, viewId: string) {
  return `star:${path}:${viewId}`
}

/** 点箭头：只切这一个 key。点记录不得走这里。 */
export function toggleExpandedViewKey(current: string | null, key: string) {
  return current === key ? null : key
}

export function pathForCenter(center: Pick<DataCenter, 'collection' | 'viewId' | 'recordId'>) {
  if (center.recordId) return databaseRecordPath(center.collection, center.recordId)
  return databaseViewPath(center.collection, center.viewId)
}

export function parseCenterPath(pathname: string): DataCenter | null {
  const parsed = parseAppPath(pathname, DATABASE)
  if (parsed.kind === 'record') {
    return { collection: parsed.collection, recordId: parsed.recordId }
  }
  if (parsed.kind === 'collection-view') {
    return { collection: parsed.collection, viewId: parsed.viewId }
  }
  return null
}

export function applySidebarAction(state: SidebarNavState, action: SidebarNavAction): SidebarNavState {
  if (action.type === 'toggle-preview') {
    return { ...state, expandedViewKey: toggleExpandedViewKey(state.expandedViewKey, action.key) }
  }
  if (action.type === 'toggle-sidebar') {
    return { ...state, viewsOpen: !state.viewsOpen }
  }
  if (action.type === 'toggle-table') {
    return {
      ...state,
      openTables: { ...state.openTables, [action.path]: !state.openTables[action.path] },
    }
  }
  if (action.type === 'open-table') {
    return {
      ...state,
      collection: action.path,
      viewId: action.viewId,
      recordId: undefined,
      lastViewId: action.viewId ?? state.lastViewId,
      openTables: { ...state.openTables, [action.path]: true },
    }
  }
  if (action.type === 'open-view') {
    return {
      ...state,
      collection: action.path,
      viewId: action.viewId,
      recordId: undefined,
      lastViewId: action.viewId,
      openTables: { ...state.openTables, [action.path]: true },
    }
  }
  if (action.type === 'open-record') {
    const sameCollection = action.path === state.collection
    return {
      ...state,
      collection: action.path,
      recordId: action.recordId,
      viewId: undefined,
      lastViewId: sameCollection ? (state.recordId ? state.lastViewId : state.viewId) : undefined,
      openTables: { ...state.openTables, [action.path]: true },
    }
  }
  const backTo = state.lastViewId
  return {
    ...state,
    recordId: undefined,
    viewId: backTo,
  }
}

export function assertSidebarInvariants(before: SidebarNavState, action: SidebarNavAction, after: SidebarNavState) {
  const path = pathForCenter(after)
  const parsed = parseCenterPath(path)
  if (!parsed) throw new Error(`无法解析路径 ${path}`)
  if (after.recordId) {
    if (path.includes('/view/')) throw new Error(`记录路径不应带 view：${path}`)
    if (parsed.recordId !== after.recordId) throw new Error(`记录 id 与路径不一致：${path}`)
    if (parsed.collection !== after.collection) throw new Error(`记录集合与路径不一致：${path}`)
  } else if (after.viewId) {
    if (path.includes('/record/')) throw new Error(`视图路径不应带 record：${path}`)
    if (parsed.viewId !== after.viewId) throw new Error(`视图 id 与路径不一致：${path}`)
  }
  if (action.type === 'open-record' || action.type === 'close-record') {
    if (after.expandedViewKey !== before.expandedViewKey) {
      throw new Error('点记录或返回不得改展开状态')
    }
    if (after.viewsOpen !== before.viewsOpen) {
      throw new Error('点记录或返回不得改侧栏开关')
    }
  }
  if (action.type === 'toggle-preview') {
    if (after.expandedViewKey !== toggleExpandedViewKey(before.expandedViewKey, action.key)) {
      throw new Error('展开切换结果不对')
    }
    if (pathForCenter(after) !== pathForCenter(before)) {
      throw new Error('点展开箭头不得改路由')
    }
  }
  if (action.type === 'toggle-sidebar') {
    if (after.viewsOpen === before.viewsOpen) throw new Error('侧栏开关未翻转')
    if (pathForCenter(after) !== pathForCenter(before)) throw new Error('收起侧栏不得改路由')
    if (after.expandedViewKey !== before.expandedViewKey) throw new Error('收起整栏不得改视图展开')
  }
}
