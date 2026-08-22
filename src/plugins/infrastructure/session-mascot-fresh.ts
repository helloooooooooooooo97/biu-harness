/** 侧栏头像 intro：新建 session 后短暂可播放动画。 */
export const SIDEBAR_MASCOT_INTRO_MS = 3000

const freshUntilById = new Map<string, number>()

export function markSidebarMascotFresh(sessionId: string, ms = SIDEBAR_MASCOT_INTRO_MS) {
  if (!sessionId) return
  freshUntilById.set(sessionId, Date.now() + ms)
}

export function remainingSidebarMascotIntroMs(sessionId: string | undefined) {
  if (!sessionId) return 0
  const until = freshUntilById.get(sessionId)
  if (!until) return 0
  const left = until - Date.now()
  if (left <= 0) {
    freshUntilById.delete(sessionId)
    return 0
  }
  return left
}

export function clearSidebarMascotFresh(sessionId: string) {
  freshUntilById.delete(sessionId)
}
