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

export type GrokShape = (typeof GROK_SHAPES)[number]
export type GrokColor = (typeof GROK_COLORS)[number]

export type SessionMascot = {
  shape: GrokShape
  color: GrokColor
}

export function isSessionMascot(value: unknown): value is SessionMascot {
  if (!value || typeof value !== 'object') return false
  const v = value as { shape?: unknown; color?: unknown }
  return (
    typeof v.shape === 'string' &&
    typeof v.color === 'string' &&
    (GROK_SHAPES as readonly string[]).includes(v.shape) &&
    (GROK_COLORS as readonly string[]).includes(v.color)
  )
}

export function parseSessionMascot(raw: string | null | undefined): SessionMascot | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    return isSessionMascot(parsed) ? parsed : undefined
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
export function mascotFromSessionId(id: string): SessionMascot {
  const seed = hashSessionId(id)
  const shape = GROK_SHAPES[seed % GROK_SHAPES.length]!
  const color = GROK_COLORS[Math.floor(seed / GROK_SHAPES.length) % GROK_COLORS.length]!
  return { shape, color }
}

function comboKey(shape: GrokShape, color: GrokColor) {
  return `${shape}:${color}`
}

/** Prefer unused combos at create time; still seeded by session id. */
export function pickSessionMascot(sessionId: string, used: Iterable<SessionMascot>): SessionMascot {
  const usedKeys = new Set([...used].map((m) => comboKey(m.shape, m.color)))
  const seed = hashSessionId(sessionId)
  const shapeCount = GROK_SHAPES.length
  const colorCount = GROK_COLORS.length
  const total = shapeCount * colorCount

  for (let i = 0; i < total; i += 1) {
    const n = (seed + i) % total
    const shape = GROK_SHAPES[n % shapeCount]!
    const color = GROK_COLORS[Math.floor(n / shapeCount) % colorCount]!
    if (!usedKeys.has(comboKey(shape, color))) return { shape, color }
  }
  return mascotFromSessionId(sessionId)
}
