/** `/` | `/s/:id` | `/s/:id/trajectory` | `/workspace` */
export type RouteView = 'chat' | 'trajectory'

export type AppRoute =
  | { kind: 'home' }
  | { kind: 'session'; sessionId: string; view: RouteView }
  | { kind: 'module'; moduleId: 'workspace' }

export function parseAppPath(pathname: string): AppRoute {
  const path = normalizePath(pathname)
  if (path === '/workspace') return { kind: 'module', moduleId: 'workspace' }
  if (path === '/') return { kind: 'home' }
  const match = path.match(/^\/s\/([^/]+)(?:\/(chat|trajectory))?$/)
  if (!match?.[1]) return { kind: 'home' }
  return {
    kind: 'session',
    sessionId: decodeURIComponent(match[1]),
    view: match[2] === 'trajectory' ? 'trajectory' : 'chat',
  }
}

/** 已知应用 path（未知则 Navigate 回 `/`，且不拆 Shell）。 */
export function isKnownAppPath(pathname: string): boolean {
  const path = normalizePath(pathname)
  if (path === '/' || path === '/workspace') return true
  return /^\/s\/[^/]+(?:\/(chat|trajectory))?$/.test(path)
}

export function buildAppPath(route: AppRoute): string {
  if (route.kind === 'home') return '/'
  if (route.kind === 'module') return route.moduleId === 'workspace' ? '/workspace' : '/'
  if (route.view === 'trajectory') return `/s/${encodeURIComponent(route.sessionId)}/trajectory`
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
