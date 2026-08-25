import {
  GROK_COLORS,
  GROK_EYE_FRAME_COUNT,
  GROK_REST_EYES,
  GROK_SHAPES,
  type GrokColor,
  type GrokShape,
  type SessionMascotIdentity,
} from './grok-bot-types.ts'

export type { SessionMascotIdentity }

/** Stable default when no session is selected. */
export const DEFAULT_SESSION_MASCOT: SessionMascotIdentity = {
  shape: 'blob',
  color: 'cyan',
  eye: GROK_REST_EYES[0]!,
}

function isShape(v: unknown): v is GrokShape {
  return typeof v === 'string' && (GROK_SHAPES as readonly string[]).includes(v)
}

function isColor(v: unknown): v is GrokColor {
  return typeof v === 'string' && (GROK_COLORS as readonly string[]).includes(v)
}

function normalizeEye(value: unknown, seed: number): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < GROK_EYE_FRAME_COUNT) {
    return value
  }
  return GROK_REST_EYES[seed % GROK_REST_EYES.length]!
}

export function isSessionMascotIdentity(value: unknown): value is SessionMascotIdentity {
  if (!value || typeof value !== 'object') return false
  const v = value as { shape?: unknown; color?: unknown; eye?: unknown }
  if (!isShape(v.shape) || !isColor(v.color)) return false
  if (v.eye === undefined) return true
  return typeof v.eye === 'number' && Number.isInteger(v.eye) && v.eye >= 0 && v.eye < GROK_EYE_FRAME_COUNT
}

function hashSessionId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Keep in sync with packages/host-sessions/src/session-mascot.ts `mascotFromSessionId`. */
export function mascotFromSessionId(id: string): SessionMascotIdentity {
  const seed = hashSessionId(id)
  const shape = GROK_SHAPES[seed % GROK_SHAPES.length]!
  const color = GROK_COLORS[Math.floor(seed / GROK_SHAPES.length) % GROK_COLORS.length]!
  const eye =
    GROK_REST_EYES[
      Math.floor(seed / (GROK_SHAPES.length * GROK_COLORS.length)) % GROK_REST_EYES.length
    ]!
  return { shape, color, eye }
}

/** Prefer server-persisted mascot; otherwise stable hash fallback (never random). */
export function resolveSessionMascot(
  sessionId: string,
  mascot?: SessionMascotIdentity | { shape: string; color: string; eye?: number } | null,
): SessionMascotIdentity {
  if (isSessionMascotIdentity(mascot)) {
    const seed = hashSessionId(sessionId)
    return {
      shape: mascot.shape,
      color: mascot.color,
      eye: normalizeEye(mascot.eye, Math.floor(seed / (GROK_SHAPES.length * GROK_COLORS.length))),
    }
  }
  return mascotFromSessionId(sessionId)
}
