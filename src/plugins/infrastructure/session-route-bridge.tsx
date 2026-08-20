import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { bindSessionView, type SessionViewService } from './session-view.ts'
import { buildAppPath, parseAppPath, routeFromState } from './session-route.ts'

/** React Router ↔ sessionView 双向桥：URL 权威在 Router，会话权威在 Service。 */
export function SessionRouteBridge({ sessionView }: { sessionView: SessionViewService }) {
  const location = useLocation()
  const navigate = useNavigate()
  const useSessionView = bindSessionView(sessionView)
  const sessionId = useSessionView((state) => state.sessionId)
  const view = useSessionView((state) => state.view)

  useEffect(() => {
    const route = parseAppPath(location.pathname)
    sessionView.beginRouteApply()
    void sessionView
      .applyRoute(route)
      .catch(() => {
        if (location.pathname !== '/') navigate('/', { replace: true })
      })
      .finally(() => {
        queueMicrotask(() => sessionView.endRouteApply())
      })
  }, [location.pathname, navigate, sessionView])

  useEffect(() => {
    if (sessionView.isRouteApplying()) return
    const target = buildAppPath(routeFromState(sessionId, view))
    if (location.pathname === target) return
    navigate(target)
  }, [sessionId, view, location.pathname, navigate, sessionView])

  return null
}
