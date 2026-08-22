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
  if (now - lastDrive >= FRAME_MS) {
    lastDrive = now
    for (const bot of bots) {
      if (bot.paused) continue
      bot._tick(now)
    }
  }
  let anyActive = false
  for (const bot of bots) {
    if (!bot.paused) {
      anyActive = true
      break
    }
  }
  if (!anyActive || bots.size === 0) {
    rafId = 0
    return
  }
  rafId = requestAnimationFrame(drive)
}

function ensureLoop() {
  if (rafId) return
  lastDrive = 0
  rafId = requestAnimationFrame(drive)
}

/**
 * Detach a GrokCharacter from its private RAF and register on the shared ticker.
 * Safe to call once per instance after construction.
 */
export function attachSharedTicker(bot: object) {
  const raw = bot as Tickable & { setPaused?: (v: boolean) => void }
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

  const innerSetPaused = raw.setPaused?.bind(raw)
  if (innerSetPaused) {
    raw.setPaused = (value: boolean) => {
      innerSetPaused(value)
      if (!value) ensureLoop()
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

/** Keep hop/spin tricks off so expression cycling stays smooth. */
export function suppressSidebarTricks(bot: object) {
  const raw = bot as {
    trickAt?: number
    celebrateAt?: number
    trick?: unknown
    hopAt?: number
  }
  raw.trickAt = Number.POSITIVE_INFINITY
  raw.celebrateAt = -1
  raw.trick = null
  raw.hopAt = -1
}

/** Idle static / intro onboarding / busy thinking. */
export function applySidebarMood(bot: object, mood: 'static' | 'intro' | 'busy') {
  const raw = bot as {
    setMode?: (m: string) => void
    setState?: (s: string, o?: { resetEyes?: boolean }) => void
  }
  suppressSidebarTricks(bot)
  if (mood === 'busy') {
    raw.setMode?.('hold')
    raw.setState?.('thinking', { resetEyes: false })
    return
  }
  if (mood === 'intro') {
    raw.setMode?.('onboarding')
    return
  }
  raw.setMode?.('hold')
  raw.setState?.('idle', { resetEyes: false })
}
