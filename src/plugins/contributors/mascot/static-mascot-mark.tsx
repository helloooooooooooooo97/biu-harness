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

type FaceTune = { x: number; y: number; sx: number; sy: number; eye: number }
type GeoSnapshot = {
  path: string
  fill: string
  eyePaths: [string, string] | null
  face: FaceTune
  Re: number
  viewBox: { minX: number; minY: number; width: number; height: number }
}

const FACE_GAP = 1.18
const DEFAULT_FACE: FaceTune = { x: 0, y: 0, sx: 1, sy: 1, eye: 1 }
const DEFAULT_VB = { minX: -15, minY: -15, width: 259, height: 259 }

/**
 * 侧栏静止头像：身体轮廓 + 默认睁眼，不挂 GrokCharacter / RAF。
 */
export const StaticMascotMark = memo(function StaticMascotMark({
  identity,
  size = 28,
  busy = false,
  className,
  title = 'Session mascot',
}: StaticMascotMarkProps) {
  const [geo, setGeo] = useState<GeoSnapshot | null>(() => readGeo(identity))

  useEffect(() => {
    let cancelled = false
    void loadGrokGeo().then(() => {
      if (cancelled) return
      setGeo(readGeo(identity))
    })
    return () => {
      cancelled = true
    }
  }, [identity.shape, identity.color])

  const vb = geo?.viewBox ?? DEFAULT_VB
  const ready = Boolean(geo?.path)

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
          opacity: ready ? 1 : 0.35,
        }}
      >
        {geo?.path ? <path d={geo.path} fill={geo.fill} /> : null}
        {geo?.eyePaths ? (
          <g transform={faceTransform(geo.Re, geo.face)}>
            <path d={geo.eyePaths[0]} fill="#fff" />
            <path d={geo.eyePaths[1]} fill="#fff" />
          </g>
        ) : null}
      </svg>
      {busy ? <span className="sidebar-mascot-status" aria-hidden /> : null}
    </span>
  )
})

function readGeo(identity: SessionMascotIdentity): GeoSnapshot | null {
  const root = typeof window !== 'undefined' ? window.GROK_GEO : undefined
  if (!root) return null
  const shape = root.shapes?.[identity.shape] ?? root.shapes?.blob
  const path = shape?.path ?? ''
  if (!path) return null
  const face = {
    ...DEFAULT_FACE,
    ...(shape && 'face' in shape && shape.face && typeof shape.face === 'object' ? shape.face : {}),
  } as FaceTune
  const frame = root.eyes?.[0]
  const eyePaths =
    frame && frame.length >= 2
      ? ([polyPath(frame[0]!), polyPath(frame[1]!)] as [string, string])
      : null
  return {
    path,
    fill: root.palette?.[identity.color]?.light ?? '#1CC3B0',
    eyePaths,
    face,
    Re: root.Re ?? 114.27,
    viewBox: root.viewBox ?? DEFAULT_VB,
  }
}

function polyPath(poly: number[][]) {
  if (!poly.length) return ''
  let d = ''
  for (let i = 0; i < poly.length; i++) {
    const [x, y] = poly[i]!
    d += `${i === 0 ? 'M' : 'L'}${x} ${y}`
  }
  return `${d}Z`
}

/** 与运行时 FACE_TUNE.gap 对齐的粗略脸部摆位，让眼睛落在轮廓里。 */
function faceTransform(Re: number, face: FaceTune) {
  const sx = face.sx * FACE_GAP
  const sy = face.sy
  return `translate(${Re + face.x} ${Re + face.y}) scale(${sx} ${sy}) translate(${-Re} ${-Re})`
}
