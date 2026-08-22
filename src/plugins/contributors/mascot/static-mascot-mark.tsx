import { memo, useEffect, useState } from 'react'
import { loadGrokGeo } from './grok-bot-loader.ts'
import type { GrokColor, GrokShape, SessionMascotIdentity } from './grok-bot-types.ts'

export type StaticMascotMarkProps = {
  identity: SessionMascotIdentity
  size?: number
  busy?: boolean
  className?: string
  title?: string
}

/**
 * 侧栏静止头像：只画 GROK_GEO 轮廓，不挂 GrokCharacter / RAF。
 * 展开分组时避免 N 个完整角色同时构造拖垮主线程。
 */
export const StaticMascotMark = memo(function StaticMascotMark({
  identity,
  size = 28,
  busy = false,
  className,
  title = 'Session mascot',
}: StaticMascotMarkProps) {
  const [ready, setReady] = useState(() => Boolean(typeof window !== 'undefined' && window.GROK_GEO))
  const [path, setPath] = useState(() => (typeof window !== 'undefined' ? shapePath(identity.shape) : ''))
  const [fill, setFill] = useState(() => (typeof window !== 'undefined' ? colorFill(identity.color) : '#1CC3B0'))
  const viewBox =
    typeof window !== 'undefined' ? window.GROK_GEO?.viewBox : undefined

  useEffect(() => {
    let cancelled = false
    void loadGrokGeo().then(() => {
      if (cancelled) return
      setPath(shapePath(identity.shape))
      setFill(colorFill(identity.color))
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [identity.shape, identity.color])

  const vb = viewBox ?? { minX: -15, minY: -15, width: 259, height: 259 }

  return (
    <span
      className={`sidebar-mascot session-mascot-mark${busy ? ' is-busy' : ''}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size, display: 'inline-grid', placeItems: 'center' }}
      title={title}
      data-busy={busy ? 'true' : undefined}
    >
      <svg
        role="img"
        aria-label={title}
        width={size}
        height={size}
        viewBox={`${vb.minX} ${vb.minY} ${vb.width} ${vb.height}`}
        style={{
          width: size,
          height: size,
          overflow: 'visible',
          opacity: ready && path ? 1 : 0.35,
        }}
      >
        {path ? <path d={path} fill={fill} /> : null}
      </svg>
      {busy ? <span className="sidebar-mascot-status" aria-hidden /> : null}
    </span>
  )
})

function shapePath(shape: GrokShape) {
  return window.GROK_GEO?.shapes?.[shape]?.path ?? window.GROK_GEO?.shapes?.blob?.path ?? ''
}

function colorFill(color: GrokColor) {
  return window.GROK_GEO?.palette?.[color]?.light ?? '#1CC3B0'
}
