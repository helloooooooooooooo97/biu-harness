import {
  GROK_COLORS,
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
}

function isShape(v: unknown): v is GrokShape {
  return typeof v === 'string' && (GROK_SHAPES as readonly string[]).includes(v)
}

function isColor(v: unknown): v is GrokColor {
  return typeof v === 'string' && (GROK_COLORS as readonly string[]).includes(v)
}

export function isSessionMascotIdentity(value: unknown): value is SessionMascotIdentity {
  if (!value || typeof value !== 'object') return false
  const v = value as { shape?: unknown; color?: unknown }
  return isShape(v.shape) && isColor(v.color)
}

/** Keep in sync with host/plugins/core/session-mascot.ts `mascotFromSessionId`. */
export function mascotFromSessionId(id: string): SessionMascotIdentity {
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const seed = h >>> 0
  const shape = GROK_SHAPES[seed % GROK_SHAPES.length]!
  const color = GROK_COLORS[Math.floor(seed / GROK_SHAPES.length) % GROK_COLORS.length]!
  return { shape, color }
}

/** Prefer server-persisted mascot; otherwise stable hash fallback (never random). */
export function resolveSessionMascot(
  sessionId: string,
  mascot?: SessionMascotIdentity | { shape: string; color: string } | null,
): SessionMascotIdentity {
  if (isSessionMascotIdentity(mascot)) return mascot
  return mascotFromSessionId(sessionId)
}
