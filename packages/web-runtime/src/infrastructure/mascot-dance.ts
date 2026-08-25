/** 全局彩蛋：所有 session 的 mascot 一起跳舞。 */
export const MASCOT_DANCE_DEFAULT_MS = 8000

export type MascotDanceShape = 'heart' | 'circle' | 'square' | 'row' | 'biu'

const danceUntilById: Record<string, number> = {}
let danceShape: MascotDanceShape = 'circle'
const listeners = new Set<() => void>()
let danceTimer: ReturnType<typeof setTimeout> | null = null

function notify() {
  for (const fn of listeners) fn()
}

/**
 * 触发一场全局 mascot 跳舞。由 snapshot 收到 host 的 'mascot' 广播时调用。
 * 多次触发会延长/重置剩余时长，但不会叠加新定时器。
 */
export function startMascotDance(
  durationMs = MASCOT_DANCE_DEFAULT_MS,
  shape: MascotDanceShape = 'circle',
) {
  if (!shape || !['heart', 'circle', 'square', 'row', 'biu'].includes(shape)) shape = 'circle'
  danceShape = shape
  const until = Date.now() + Math.max(1500, durationMs)
  // 取较晚的结束点，让连续触发顺延结束
  danceUntilById.all = Math.max(danceUntilById.all ?? 0, until)
  if (danceTimer) clearTimeout(danceTimer)
  const left = danceUntilById.all - Date.now()
  danceTimer = setTimeout(() => {
    danceTimer = null
    delete danceUntilById.all
    notify()
  }, left)
  notify()
}

export function mascotDanceShape(): MascotDanceShape {
  return danceShape
}

/** 仍在跳舞窗口内返回剩余毫秒，否则 0。 */
export function remainingMascotDanceMs(): number {
  const until = danceUntilById.all
  if (!until) return 0
  const left = until - Date.now()
  if (left <= 0) {
    delete danceUntilById.all
    return 0
  }
  return left
}

export function isMascotDancing(): boolean {
  return remainingMascotDanceMs() > 0
}

export function subscribeMascotDance(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function stopMascotDance() {
  if (danceTimer) {
    clearTimeout(danceTimer)
    danceTimer = null
  }
  delete danceUntilById.all
  notify()
}
