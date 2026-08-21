type Tickable = {
  paused: boolean
  last: number
  _raf: number
  _tick: (now: number) => void
  __shared?: boolean
}

const bots = new Set<Tickable>()
let rafId = 0
let lastDrive = 0

/** Sidebar bots share one clock (~30fps) instead of N×60 RAF loops. */
const FRAME_MS = 1000 / 30

function drive(now: number) {
  rafId = requestAnimationFrame(drive)
  if (now - lastDrive < FRAME_MS) return
  lastDrive = now
  for (const bot of bots) {
    if (bot.paused) continue
    bot._tick(now)
  }
  if (bots.size === 0 && rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
}

function ensureLoop() {
  if (!rafId) {
    lastDrive = 0
    rafId = requestAnimationFrame(drive)
  }
}

/**
 * Detach a GrokCharacter from its private RAF and register on the shared ticker.
 * Safe to call once per instance after construction.
 */
export function attachSharedTicker(bot: object) {
  const raw = bot as Tickable
  if (raw.__shared) return
  if (raw._raf) {
    cancelAnimationFrame(raw._raf)
    raw._raf = 0
  }

  const inner = raw._tick.bind(raw)
  raw._tick = (now: number) => {
    // Inner tick normally schedules the next frame at the end — neutralize that.
    const prevRaf = raw._raf
    inner(now)
    if (raw._raf && raw._raf !== prevRaf) {
      cancelAnimationFrame(raw._raf)
      raw._raf = 0
    }
  }

  raw.__shared = true
  bots.add(raw)
  ensureLoop()
}

export function detachSharedTicker(bot: object) {
  const raw = bot as Tickable
  if (!raw.__shared) return
  bots.delete(raw)
  raw.__shared = false
  if (raw._raf) {
    cancelAnimationFrame(raw._raf)
    raw._raf = 0
  }
  if (bots.size === 0 && rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
}

/** Quiet a character: no onboarding mood thrash, no hop/spin tricks. */
export function quietSidebarMotion(bot: object) {
  const raw = bot as {
    mode?: string
    trickAt?: number
    celebrateAt?: number
    trick?: unknown
    hopAt?: number
    setMode?: (m: string) => void
    setState?: (s: string, o?: { resetEyes?: boolean }) => void
  }
  raw.setMode?.('hold')
  raw.setState?.('idle', { resetEyes: false })
  raw.trickAt = Number.POSITIVE_INFINITY
  raw.celebrateAt = -1
  raw.trick = null
  raw.hopAt = -1
}
