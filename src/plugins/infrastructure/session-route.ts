/** `/` | `/s/:id` | `/s/:id/trajectory`（`/chat` 可省略） */
export type RouteView = 'chat' | 'trajectory'

export type AppRoute =
  | { kind: 'home' }
  | { kind: 'session'; sessionId: string; view: RouteView }

export function parseAppPath(pathname: string): AppRoute {
  const path = normalizePath(pathname)
  if (path === '/') return { kind: 'home' }
  const match = path.match(/^\/s\/([^/]+)(?:\/(chat|trajectory))?$/)
  if (!match?.[1]) return { kind: 'home' }
  return {
    kind: 'session',
    sessionId: decodeURIComponent(match[1]),
    view: match[2] === 'trajectory' ? 'trajectory' : 'chat',
  }
}

export function buildAppPath(route: AppRoute): string {
  if (route.kind === 'home') return '/'
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
