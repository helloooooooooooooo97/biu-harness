import {
  GROK_COLORS,
  GROK_SHAPES,
  type GrokColor,
  type GrokShape,
  type SessionMascotIdentity,
} from './grok-bot-types.ts'

const STORAGE_KEY = 'dsh.session-mascots.v1'

type Store = Record<string, SessionMascotIdentity>

function isShape(v: unknown): v is GrokShape {
  return typeof v === 'string' && (GROK_SHAPES as readonly string[]).includes(v)
}

function isColor(v: unknown): v is GrokColor {
  return typeof v === 'string' && (GROK_COLORS as readonly string[]).includes(v)
}

function readStore(): Store {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, { shape?: unknown; color?: unknown }>
    const out: Store = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (isShape(value?.shape) && isColor(value?.color)) {
        out[id] = { shape: value.shape, color: value.color }
      }
    }
    return out
  } catch {
    return {}
  }
}

function writeStore(store: Store) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* quota / private mode */
  }
}

function hashId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function comboKey(shape: GrokShape, color: GrokColor) {
  return `${shape}:${color}`
}

function pickFresh(used: Set<string>, seed: number): SessionMascotIdentity {
  const shapeCount = GROK_SHAPES.length
  const colorCount = GROK_COLORS.length
  const total = shapeCount * colorCount

  for (let i = 0; i < total; i += 1) {
    const n = (seed + i) % total
    const shape = GROK_SHAPES[n % shapeCount]!
    const color = GROK_COLORS[Math.floor(n / shapeCount) % colorCount]!
    const key = comboKey(shape, color)
    if (!used.has(key)) return { shape, color }
  }

  // All combos taken — still deterministic per seed.
  const shape = GROK_SHAPES[seed % shapeCount]!
  const color = GROK_COLORS[Math.floor(seed / shapeCount) % colorCount]!
  return { shape, color }
}

/** Stable default when no session is selected. */
export const DEFAULT_SESSION_MASCOT: SessionMascotIdentity = {
  shape: 'blob',
  color: 'cyan',
}

/** Read identity without creating one. */
export function peekSessionMascot(sessionId: string): SessionMascotIdentity | null {
  const store = readStore()
  return store[sessionId] ?? null
}

/**
 * Ensure a session has a shape+color role.
 * Prefers unused combinations among already-assigned chats so the sidebar stays distinct.
 */
export function getOrAssignSessionMascot(sessionId: string): SessionMascotIdentity {
  const store = readStore()
  const existing = store[sessionId]
  if (existing) return existing

  const used = new Set<string>()
  for (const [id, value] of Object.entries(store)) {
    if (id === sessionId) continue
    used.add(comboKey(value.shape, value.color))
  }

  const next = pickFresh(used, hashId(sessionId))
  store[sessionId] = next
  writeStore(store)
  return next
}

/** Assign (or reaffirm) identity right after creating a chat. */
export function assignSessionMascot(sessionId: string): SessionMascotIdentity {
  return getOrAssignSessionMascot(sessionId)
}

export function releaseSessionMascot(sessionId: string) {
  const store = readStore()
  if (!(sessionId in store)) return
  delete store[sessionId]
  writeStore(store)
}

/** Backfill identities for a session list (idempotent). */
export function ensureSessionMascots(sessionIds: string[]): Record<string, SessionMascotIdentity> {
  const out: Record<string, SessionMascotIdentity> = {}
  for (const id of sessionIds) {
    out[id] = getOrAssignSessionMascot(id)
  }
  return out
}
