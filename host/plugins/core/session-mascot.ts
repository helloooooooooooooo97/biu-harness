/** Shared session mascot identity — keep frontend mirror in sync. */

export const GROK_SHAPES = [
  'blob',
  'pebble',
  'bean',
  'egg',
  'squircle',
  'tablet',
  'capsule',
  'cylinder',
  'hex',
  'gem',
  'crystal',
  'wedge',
  'shield',
  'dome',
  'arch',
  'cloud',
  'teardrop',
  'leaf',
] as const

export const GROK_COLORS = [
  'black',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'cyan',
  'blue',
  'violet',
  'magenta',
  'gray',
] as const

/** Distinct resting eye morphs — avoid closed/sleep frames for idle marks. */
export const GROK_REST_EYES = [
  0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24,
] as const

export const GROK_EYE_FRAME_COUNT = 25

export type GrokShape = (typeof GROK_SHAPES)[number]
export type GrokColor = (typeof GROK_COLORS)[number]

export type SessionMascot = {
  shape: GrokShape
  color: GrokColor
  eye?: number
}

export function isSessionMascot(value: unknown): value is SessionMascot {
  if (!value || typeof value !== 'object') return false
  const v = value as { shape?: unknown; color?: unknown; eye?: unknown }
  if (
    typeof v.shape !== 'string' ||
    typeof v.color !== 'string' ||
    !(GROK_SHAPES as readonly string[]).includes(v.shape) ||
    !(GROK_COLORS as readonly string[]).includes(v.color)
  ) {
    return false
  }
  if (v.eye === undefined) return true
  return typeof v.eye === 'number' && Number.isInteger(v.eye) && v.eye >= 0 && v.eye < GROK_EYE_FRAME_COUNT
}

function normalizeEye(value: unknown, seed: number): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < GROK_EYE_FRAME_COUNT) {
    return value
  }
  return GROK_REST_EYES[seed % GROK_REST_EYES.length]!
}

/** Ensure eye is always present (legacy shape+color records get a stable fill). */
export function ensureSessionMascot(
  sessionId: string,
  mascot: { shape: GrokShape; color: GrokColor; eye?: number },
): { shape: GrokShape; color: GrokColor; eye: number } {
  const seed = hashSessionId(sessionId)
  return {
    shape: mascot.shape,
    color: mascot.color,
    eye: normalizeEye(
      mascot.eye,
      Math.floor(seed / (GROK_SHAPES.length * GROK_COLORS.length)),
    ),
  }
}

export function parseSessionMascot(raw: string | null | undefined): SessionMascot | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isSessionMascot(parsed)) return undefined
    // eye may be missing on legacy JSON — caller should ensureSessionMascot
    return parsed as SessionMascot
  } catch {
    return undefined
  }
}

export function hashSessionId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Stable fallback from id alone — never changes for a given session id. */
export function mascotFromSessionId(id: string): { shape: GrokShape; color: GrokColor; eye: number } {
  const seed = hashSessionId(id)
  const shape = GROK_SHAPES[seed % GROK_SHAPES.length]!
  const color = GROK_COLORS[Math.floor(seed / GROK_SHAPES.length) % GROK_COLORS.length]!
  const eye =
    GROK_REST_EYES[
      Math.floor(seed / (GROK_SHAPES.length * GROK_COLORS.length)) % GROK_REST_EYES.length
    ]!
  return { shape, color, eye }
}

function comboKey(shape: GrokShape, color: GrokColor) {
  return `${shape}:${color}`
}

/** Prefer unused combos at create time; still seeded by session id. */
export function pickSessionMascot(
  sessionId: string,
  used: Iterable<SessionMascot>,
): { shape: GrokShape; color: GrokColor; eye: number } {
  const usedKeys = new Set([...used].map((m) => comboKey(m.shape, m.color)))
  const seed = hashSessionId(sessionId)
  const shapeCount = GROK_SHAPES.length
  const colorCount = GROK_COLORS.length
  const eyeCount = GROK_REST_EYES.length
  const total = shapeCount * colorCount

  for (let i = 0; i < total; i += 1) {
    const n = (seed + i) % total
    const shape = GROK_SHAPES[n % shapeCount]!
    const color = GROK_COLORS[Math.floor(n / shapeCount) % colorCount]!
    const eye = GROK_REST_EYES[(Math.floor(seed / total) + i) % eyeCount]!
    if (!usedKeys.has(comboKey(shape, color))) return { shape, color, eye }
  }
  return mascotFromSessionId(sessionId)
}
