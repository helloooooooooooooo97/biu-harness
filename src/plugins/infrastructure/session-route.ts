/** `/` | `/s/:id` | `/s/:id/debug` | 插件 register 的 path */
import { matchRegisteredModule, type AppModule } from './app-modules.ts'

export type RouteView = 'chat' | 'debug'

export type AppRoute =
  | { kind: 'home' }
  | { kind: 'session'; sessionId: string; view: RouteView }
  | { kind: 'module'; moduleId: string; path: string }

export function parseAppPath(pathname: string, plugins: AppModule[] = []): AppRoute {
  const path = normalizePath(pathname)
  const hit = matchRegisteredModule(path, plugins)
  if (hit) return { kind: 'module', moduleId: hit.id, path: hit.path }
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
  if (route.view === 'debug') return `/s/${encodeURIComponent(route.sessionId)}/debug`
  return `/s/${encodeURIComponent(route.sessionId)}`
}

export function routeFromState(sessionId: string | null, view: RouteView): AppRoute {
  if (!sessionId) return { kind: 'home' }
  return { kind: 'session', sessionId, view }
}

export function normalizePath(pathname: string) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}
