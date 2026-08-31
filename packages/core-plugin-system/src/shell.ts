export const WIN_CHROME_H = 32
export const WIN_DEFAULT_W = 480
export const WIN_DEFAULT_H = 360
export const WIN_ABS_MIN = 80
export const WIN_ABS_MAX = 8192

export type StoreShell = {
  width: number
  height: number
  minWidth: number
  minHeight: number
  resizable: boolean
}

export type WinGeom = { x: number; y: number; w: number; h: number }

export function defaultStoreShell(): StoreShell {
  return {
    width: WIN_DEFAULT_W,
    height: WIN_DEFAULT_H,
    minWidth: 200,
    minHeight: 160,
    resizable: true,
  }
}

function dim(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** 是否在 manifest 里显式写了内容区宽高（缺省不算声明）。 */
export function declaredStoreShell(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const rec = value as Record<string, unknown>
  const width = Number(rec.width ?? rec.w)
  const height = Number(rec.height ?? rec.h)
  return Number.isFinite(width) && Number.isFinite(height)
}

export function requireDeclaredShell(value: unknown, hasWeb: boolean, where: string) {
  if (!hasWeb) return
  if (!declaredStoreShell(value)) {
    throw new Error(`${where}: web plugins must set shell.width and shell.height (content pixels, excluding the title bar)`)
  }
}

/** manifest.shell：width/height 是内容区像素，不含标题栏。缺省 480×360。 */
export function parseStoreShell(value: unknown): StoreShell {
  const d = defaultStoreShell()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return d
  const rec = value as Record<string, unknown>
  const width = dim(rec.width ?? rec.w, d.width, WIN_ABS_MIN, WIN_ABS_MAX)
  const height = dim(rec.height ?? rec.h, d.height, WIN_ABS_MIN, WIN_ABS_MAX)
  const minWidth = dim(rec.minWidth ?? rec.min_width, Math.min(d.minWidth, width), WIN_ABS_MIN, width)
  const minHeight = dim(rec.minHeight ?? rec.min_height, Math.min(d.minHeight, height), WIN_ABS_MIN, height)
  return {
    width,
    height,
    minWidth,
    minHeight,
    resizable: rec.resizable == null ? true : rec.resizable !== false,
  }
}

export function windowOuterSize(shell: StoreShell, viewport: { w: number; h: number }): { w: number; h: number } {
  const minW = Math.min(viewport.w, Math.max(WIN_ABS_MIN, shell.minWidth))
  const minH = Math.min(viewport.h, Math.max(WIN_ABS_MIN, shell.minHeight + WIN_CHROME_H))
  return {
    w: Math.min(viewport.w, Math.max(minW, shell.width)),
    h: Math.min(viewport.h, Math.max(minH, shell.height + WIN_CHROME_H)),
  }
}

export function centeredGeom(shell: StoreShell, viewport: { w: number; h: number }, seed = ''): WinGeom {
  const size = windowOuterSize(shell, viewport)
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  const jitterX = seed ? (hash % 5) * 28 - 56 : 0
  const jitterY = seed ? (hash % 4) * 24 - 48 : 0
  return clampGeom(
    {
      x: Math.max(16, Math.round((viewport.w - size.w) / 2) + jitterX),
      y: Math.max(16, Math.round((viewport.h - size.h) / 2) + jitterY),
      ...size,
    },
    shell,
    viewport,
  )
}

export function clampGeom(next: WinGeom, shell: StoreShell, viewport: { w: number; h: number }): WinGeom {
  const minW = Math.max(WIN_ABS_MIN, shell.minWidth)
  const minH = Math.max(WIN_ABS_MIN, shell.minHeight + WIN_CHROME_H)
  const w = Math.min(viewport.w, Math.max(minW, next.w))
  const h = Math.min(viewport.h, Math.max(minH, next.h))
  const maxX = Math.max(0, viewport.w - 64)
  const maxY = Math.max(0, viewport.h - 36)
  return {
    x: Math.min(maxX, Math.max(0, next.x)),
    y: Math.min(maxY, Math.max(0, next.y)),
    w,
    h,
  }
}
