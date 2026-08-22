/** `/` | `/s/:id` | `/s/:id/debug` | `/dashboard`（兼容旧 `/trajectory`） */
export type RouteView = 'chat' | 'debug'

export type AppRoute =
  | { kind: 'home' }
  | { kind: 'session'; sessionId: string; view: RouteView }
  | { kind: 'module'; moduleId: 'dashboard' }

export function parseAppPath(pathname: string): AppRoute {
  const path = normalizePath(pathname)
  if (path === '/dashboard') return { kind: 'module', moduleId: 'dashboard' }
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

/** 已知应用 path（未知则 Navigate 回 `/`，且不拆 Shell）。 */
export function isKnownAppPath(pathname: string): boolean {
  const path = normalizePath(pathname)
  if (path === '/' || path === '/dashboard') return true
  return /^\/s\/[^/]+(?:\/(chat|debug|trajectory))?$/.test(path)
}

export function buildAppPath(route: AppRoute): string {
  if (route.kind === 'home') return '/'
  if (route.kind === 'module') {
    if (route.moduleId === 'dashboard') return '/dashboard'
    return '/'
  }
  if (route.view === 'debug') return `/s/${encodeURIComponent(route.sessionId)}/debug`
  return `/s/${encodeURIComponent(route.sessionId)}`
}

export function routeFromState(sessionId: string | null, view: RouteView): AppRoute {
  if (!sessionId) return { kind: 'home' }
  return { kind: 'session', sessionId, view }
}

function normalizePath(pathname: string) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}
