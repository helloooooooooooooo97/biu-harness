import { memo, useEffect, useState } from 'react'
import { GrokBotAvatar } from './grok-bot-avatar.tsx'
import { loadGrokBot } from './grok-bot-loader.ts'
import type { GrokColor, GrokShape, SessionMascotIdentity } from './grok-bot-types.ts'
import { DEFAULT_SESSION_MASCOT } from './session-mascot.ts'

export type SidebarMascotProps = {
  size?: number
  busy?: boolean
  className?: string
  title?: string
  /** Per-chat role; defaults to brand mascot when omitted. */
  identity?: SessionMascotIdentity
  /** When true, keep RAF paused (inactive session rows). */
  paused?: boolean
  followPointer?: boolean
}

/** Grok Bot study replica — one shape+color role per chat. */
export const SidebarMascot = memo(function SidebarMascot({
  size = 44,
  busy = false,
  className,
  title = 'Harness',
  identity = DEFAULT_SESSION_MASCOT,
  paused = false,
  followPointer = false,
}: SidebarMascotProps) {
  return (
    <GrokBotAvatar
      shape={identity.shape}
      color={identity.color}
      size={size}
      busy={busy}
      paused={paused}
      followPointer={followPointer}
      className={className}
      title={title}
    />
  )
})

/** Lightweight static silhouette for dense session lists (no RAF). */
export const SessionMascotMark = memo(function SessionMascotMark({
  shape,
  color,
  size = 28,
  title,
}: {
  shape: GrokShape
  color: GrokColor
  size?: number
  title?: string
}) {
  const [path, setPath] = useState<string | null>(null)
  const [fill, setFill] = useState('#888')
  const [viewBox, setViewBox] = useState('0 0 229 229')

  useEffect(() => {
    let cancelled = false
    void loadGrokBot().then(() => {
      if (cancelled || !window.GROK_GEO) return
      const geo = window.GROK_GEO
      const shapeData = geo.shapes[shape]
      const pal = geo.palette[color] || geo.palette.black
      if (!shapeData) return
      const vb = geo.viewBox
      setViewBox(`${vb.minX} ${vb.minY} ${vb.width} ${vb.height}`)
      setPath(shapeData.path)
      setFill(pal.light)
    })
    return () => {
      cancelled = true
    }
  }, [shape, color])

  return (
    <span
      className="sidebar-mascot session-mascot-mark"
      style={{ width: size, height: size, display: 'inline-grid', placeItems: 'center' }}
      title={title}
    >
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        role="img"
        aria-label={title || `${shape} ${color}`}
        style={{ overflow: 'visible' }}
      >
        {path ? <path d={path} fill={fill} /> : <circle cx="114" cy="114" r="40" fill={fill} opacity={0.4} />}
      </svg>
    </span>
  )
})
