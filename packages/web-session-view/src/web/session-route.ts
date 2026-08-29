/** URL = 中心舞台。
 * `/` | `/s/:id` | `/s/:id/debug` | 插件 path
 * 数据模块（默认 `/database`）：
 *   `/database` 集合入口
 *   `/database/c/:collection` 集合默认/当前视图
 *   `/database/c/:collection/v/:viewId` 已保存视图
 *   `/database/c/:collection/r/:recordId` 记录（中心页）
 *   `/database/c/:collection/v/:viewId/r/:recordId` 从某视图打开的记录（后退回视图）
 * `:collection` 为集合 path 去掉前导 `/` 再 encode（`/pages` → `pages`）。
 * 记录 id / 视图 id 不进聊天路由 `/s/:id`。
 */
import { matchRegisteredModule, type AppModule } from '@biu/web-app-modules'

export type RouteView = 'chat' | 'debug'

export type InspectorCenterKind = 'session' | 'collection-view' | 'record' | 'task' | 'module'

export type AppRoute =
  | { kind: 'home' }
  | { kind: 'session'; sessionId: string; view: RouteView }
  | { kind: 'module'; moduleId: string; path: string }
  | { kind: 'collection-view'; moduleId: string; path: string; collection: string; viewId?: string }
  | { kind: 'record'; moduleId: string; path: string; collection: string; viewId?: string; recordId: string }

const DATABASE_SEG = /^\/c\/([^/]+)(?:\/v\/([^/]+))?(?:\/r\/([^/]+))?$/

export function encodeCollectionSeg(path: string) {
  return encodeURIComponent(normalizeCollectionKey(path).replace(/^\//, ''))
}

export function decodeCollectionSeg(seg: string) {
  const raw = decodeURIComponent(seg).trim()
  if (!raw || raw === '/') return '/'
  return raw.startsWith('/') ? raw.replace(/\/+$/, '') || '/' : `/${raw.replace(/\/+$/, '')}`
}

export function normalizeCollectionKey(path: string) {
  const raw = String(path || '/').trim() || '/'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  if (withSlash === '/') return '/'
  return withSlash.replace(/\/+$/, '') || '/'
}

export function parseDatabaseRest(pathname: string, module: AppModule): AppRoute | null {
  const base = normalizePath(module.path)
  const path = normalizePath(pathname)
  if (path === base) return null
  if (!path.startsWith(`${base}/`)) return null
  const rest = path.slice(base.length)
  const match = rest.match(DATABASE_SEG)
  if (!match?.[1]) return { kind: 'module', moduleId: module.id, path: base }
  const collection = decodeCollectionSeg(match[1])
  const viewId = match[2] ? decodeURIComponent(match[2]) : undefined
  const recordId = match[3] ? decodeURIComponent(match[3]) : undefined
  if (recordId) {
    return { kind: 'record', moduleId: module.id, path: base, collection, viewId, recordId }
  }
  return { kind: 'collection-view', moduleId: module.id, path: base, collection, viewId }
}

export function parseAppPath(pathname: string, plugins: AppModule[] = []): AppRoute {
  const path = normalizePath(pathname)
  const hit = matchRegisteredModule(path, plugins)
  if (hit) {
    const nested = parseDatabaseRest(path, hit)
    if (nested) return nested
    return { kind: 'module', moduleId: hit.id, path: hit.path }
  }
  if (path === '/') return { kind: 'home' }
  const match = path.match(/^\/s\/([^/]+)(?:\/(chat|debug|trajectory))?$/)
  if (!match?.[1]) return { kind: 'home' }
  const segment = match[2]
  return {
    kind: 'session',
    sessionId: decodeURIComponent(match[1]),
    view: segment === 'debug' || segment === 'trajectory' ? 'debug' : 'chat',
  }
}

export function isKnownAppPath(pathname: string, plugins: AppModule[] = []): boolean {
  const path = normalizePath(pathname)
  if (path === '/') return true
  if (matchRegisteredModule(path, plugins)) return true
  return /^\/s\/[^/]+(?:\/(chat|debug|trajectory))?$/.test(path)
}

export function buildAppPath(route: AppRoute): string {
  if (route.kind === 'home') return '/'
  if (route.kind === 'module') return route.path || `/${route.moduleId}`
  if (route.kind === 'collection-view' || route.kind === 'record') {
    const base = route.path || `/${route.moduleId}`
    let next = `${normalizePath(base)}/c/${encodeCollectionSeg(route.collection)}`
    if (route.viewId) next += `/v/${encodeURIComponent(route.viewId)}`
    if (route.kind === 'record') next += `/r/${encodeURIComponent(route.recordId)}`
    return next
  }
  if (route.view === 'debug') return `/s/${encodeURIComponent(route.sessionId)}/debug`
  return `/s/${encodeURIComponent(route.sessionId)}`
}

export function routeFromState(sessionId: string | null, view: RouteView): AppRoute {
  if (!sessionId) return { kind: 'home' }
  return { kind: 'session', sessionId, view }
}

export function centerKindFromRoute(route: AppRoute): InspectorCenterKind {
  if (route.kind === 'collection-view') return 'collection-view'
  if (route.kind === 'record') return 'record'
  if (route.kind === 'module') return route.moduleId === 'tasks' ? 'task' : 'module'
  return 'session'
}

export function normalizePath(pathname: string) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}
