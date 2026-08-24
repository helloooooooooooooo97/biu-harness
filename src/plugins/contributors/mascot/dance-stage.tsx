import { memo } from 'react'
import type { SessionListItem } from '../../infrastructure/session-view.ts'
import type { MascotDanceShape } from '../../infrastructure/mascot-dance.ts'
import type { SessionMascotIdentity } from './grok-bot-types.ts'
import { resolveSessionMascot } from './session-mascot.ts'
import { SidebarMascot } from './sidebar-mascot.tsx'

type Dancer = {
  id: string
  identity: SessionMascotIdentity
}

/** 产品名「biu」的 3×7 字母点阵：各自是 B-I-U 的 '#' 像素。 */
const BIU_GLYPHS: string[][] = [
  // B
  [
    '###',
    '# #',
    '# #',
    '###',
    '# #',
    '# #',
    '###',
  ],
  // I
  [
    '#',
    '#',
    '#',
    '#',
    '#',
    '#',
    '#',
  ],
  // U
  [
    '# #',
    '# #',
    '# #',
    '# #',
    '# #',
    '# #',
    '###',
  ],
]

/**
 * 把「B-I-U」拼成一行像素点序列（按列→行、字母从左到右），返回每个像素的 (x, y)。
 * 全局列号跨字母连续推进（含间隙），行从顶部向下。
 */
function biuPixels(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = []
  let colOffset = 0
  for (const glyph of BIU_GLYPHS) {
    for (let r = 0; r < glyph.length; r++) {
      for (let c = 0; c < glyph[r].length; c++) {
        if (glyph[r][c] === '#') pts.push({ x: colOffset + c, y: r })
      }
    }
    colOffset += 3 + 2 // 字母宽 3，间隔 2
  }
  return pts
}

/** 计算某 shape 队形下第 i 个 dancer（共 n 个）的 (x, y) 偏移（px，中心为锚点）。 */
export function danceSlot(shape: MascotDanceShape, i: number, n: number): { x: number; y: number } {
  if (shape === 'biu') {
    const pts = biuPixels()
    const H = 7
    const W = 3 * 3 + 2 * 2 // 3 字母 × 3 宽 + 2 个间隔 × 2
    const scale = 26 // 每个像素的格子边长（px），放大铺开便于识别
    // 依次落位：第 i 个 mascot 排在点阵第 i 个像素（mascot 多余则取模环绕填满）
    const p = pts[i % pts.length]
    return {
      x: (p.x - (W - 1) / 2) * scale,
      y: (p.y - (H - 1) / 2) * scale,
    }
  }
  if (shape === 'heart') {
    // 心形参数方程，但沿轮廓「弧长均匀」采样——否则点在凹槽/顶点分布不均会被误认成圆形。
    const heartPt = (t: number) => {
      const hx = 16 * Math.pow(Math.sin(t), 3)
      const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
      return { x: hx, y: -hy }
    }
    // 密集采样累计弧长
    const STEPS = 600
    const cum: number[] = [0]
    let prev = heartPt(0)
    for (let k = 1; k <= STEPS; k++) {
      const p = heartPt((k / STEPS) * Math.PI * 2)
      cum.push(cum[k - 1] + Math.hypot(p.x - prev.x, p.y - prev.y))
      prev = p
    }
    const total = cum[STEPS]
    // 按弧长等分取第 i 个
    const target = (i / Math.max(1, n)) * total
    let k = 0
    while (k < STEPS && cum[k + 1] < target) k++
    const t = ((k + (target - cum[k]) / Math.max(1e-9, cum[k + 1] - cum[k])) / STEPS) * Math.PI * 2
    const p = heartPt(t)
    // 放大心形；agent 极少时用更大比例铺满屏幕，多时略收避免溢出
    const s = 18 - Math.min(6, Math.max(0, (n - 4) / 6))
    return { x: p.x * s, y: p.y * s }
  }
  if (shape === 'circle') {
    const t = (i / Math.max(1, n)) * Math.PI * 2
    const r = Math.min(180, 60 + Math.min(40, n) * 4)
    return { x: Math.cos(t) * r, y: Math.sin(t) * r }
  }
  if (shape === 'square') {
    // 沿正方形周长均分分布，若点极少则稳定落在顶点
    const half = 150
    const seg = i % 4 // 哪条边（上、右、下、左）
    const along = ((Math.floor(i / 4) + 1) / Math.max(1, Math.ceil(n / 4))) * 2 - 1 // -1..1
    if (seg === 0) return { x: along * half, y: -half }
    if (seg === 1) return { x: half, y: along * half }
    if (seg === 2) return { x: -along * half, y: half }
    return { x: -half, y: -along * half }
  }
  // row：默认一排，多行换行
  const perRow = 8
  const row = Math.floor(i / perRow)
  const col = i % perRow
  const rowCount = Math.ceil(n / perRow)
  const x = (col - (Math.min(perRow, n - row * perRow) - 1) / 2) * 100
  const y = (row - (rowCount - 1) / 2) * 118 + Math.sin((i % 5) * 1.7) * 10
  return { x, y }
}

/**
 * 全屏跳舞舞台：所有 session 的 mascot 从侧栏弹进屏幕中央一起跳舞（按 shape 排队形）。
 * 仅在入场到结束期间挂一层 overlay（pointer-events 忽略，不挡操作）。
 */
export const DanceStage = memo(function DanceStage({
  sessions,
  on = false,
  size = 72,
  shape = 'circle',
}: {
  sessions: SessionListItem[]
  on: boolean
  size?: number
  shape?: MascotDanceShape
}) {
  if (!on || sessions.length === 0) return null

  const dancers: Dancer[] = []
  for (const item of sessions) {
    dancers.push({ id: item.id, identity: resolveSessionMascot(item.id, item.mascot) })
  }

  return (
    <div
      className={`mascot-dance-stage${on ? ' is-on' : ''}`}
      data-shape={shape}
      aria-hidden
    >
      {dancers.map((d, i) => {
        const { x, y } = danceSlot(shape, i, dancers.length)
        // 拼字母（biu）时用紧凑尺寸，让点阵能识别出字形
        const dancerSize = shape === 'biu' ? Math.min(size, 34) : size
        return (
          <span
            key={d.id}
            className="mascot-dancer"
            style={
              {
                '--dancer-x': `${x}px`,
                '--dancer-y': `${y}px`,
                animationDelay: `${(i % 10) * 20}ms, ${420 + (i % 10) * 20}ms`,
              } as React.CSSProperties
            }
          >
            <SidebarMascot
              size={dancerSize}
              identity={d.identity}
              dancing
              animate={false}
              title={shape === 'biu' ? 'biu 🎉' : '跳舞中 🎉'}
            />
          </span>
        )
      })}
    </div>
  )
})
