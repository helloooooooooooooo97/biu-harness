import { memo, useEffect, useState } from 'react'
import { loadGrokGeo } from './grok-bot-loader.ts'
import type { GrokColor, GrokShape, SessionMascotIdentity } from './grok-bot-types.ts'
import { DEFAULT_SESSION_MASCOT } from './session-mascot.ts'

export type SidebarMascotProps = {
  size?: number
  /** Reserved for future light busy affordance (static pulse). */
  busy?: boolean
  className?: string
  title?: string
  /** Per-chat role; defaults to brand mascot when omitted. */
  identity?: SessionMascotIdentity
}

type MarkPaint = {
  path: string
  fill: string
  viewBox: string
}

const paintCache = new Map<string, MarkPaint>()

function cacheKey(shape: GrokShape, color: GrokColor) {
  return `${shape}:${color}`
}

function paintFromGeo(shape: GrokShape, color: GrokColor): MarkPaint | null {
  const geo = window.GROK_GEO
  if (!geo) return null
  const key = cacheKey(shape, color)
  const hit = paintCache.get(key)
  if (hit) return hit
  const shapeData = geo.shapes[shape]
  const pal = geo.palette[color] || geo.palette.black
  if (!shapeData || !pal) return null
  const vb = geo.viewBox
  const next: MarkPaint = {
    path: shapeData.path,
    fill: pal.light,
    viewBox: `${vb.minX} ${vb.minY} ${vb.width} ${vb.height}`,
  }
  paintCache.set(key, next)
  return next
}

/** Lightweight static silhouette — no GrokCharacter / RAF (safe on session switch). */
export const SessionMascotMark = memo(function SessionMascotMark({
  shape,
  color,
  size = 28,
  busy = false,
  className,
  title,
}: {
  shape: GrokShape
  color: GrokColor
  size?: number
  busy?: boolean
  className?: string
  title?: string
}) {
  const [paint, setPaint] = useState<MarkPaint | null>(() => paintFromGeo(shape, color))

  useEffect(() => {
    const sync = paintFromGeo(shape, color)
    if (sync) {
      setPaint(sync)
      return
    }
    let cancelled = false
    void loadGrokGeo().then(() => {
      if (cancelled) return
      setPaint(paintFromGeo(shape, color))
    })
    return () => {
      cancelled = true
    }
  }, [shape, color])

  return (
    <span
      className={`sidebar-mascot session-mascot-mark${busy ? ' is-busy' : ''}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size, display: 'inline-grid', placeItems: 'center' }}
      title={title}
    >
      <svg
        width={size}
        height={size}
        viewBox={paint?.viewBox ?? '0 0 229 229'}
        role="img"
        aria-label={title || `${shape} ${color}`}
        style={{ overflow: 'visible' }}
      >
        {paint ? (
          <path d={paint.path} fill={paint.fill} />
        ) : (
          <circle cx="114" cy="114" r="40" fill="#888" opacity={0.4} />
        )}
      </svg>
    </span>
  )
})

/**
 * Sidebar / activity brand mark.
 * Static by default — full GrokCharacter RAF was causing chat-switch jank
 * (multiple animation loops + setShape morph on every session change).
 */
export const SidebarMascot = memo(function SidebarMascot({
  size = 44,
  busy = false,
  className,
  title = 'Harness',
  identity = DEFAULT_SESSION_MASCOT,
}: SidebarMascotProps) {
  return (
    <SessionMascotMark
      shape={identity.shape}
      color={identity.color}
      size={size}
      busy={busy}
      className={className}
      title={title}
    />
  )
})
