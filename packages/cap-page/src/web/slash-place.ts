export type SlashCaret = { top: number; bottom: number; left: number }
export type SlashBox = { width: number; height: number }
export type SlashViewport = { width: number; height: number }

const GAP = 4
const PAD = 8

/** 下方会被浏览器窗口裁切时，改到光标上方。只看 window 尺寸，不看页面里的滚动容器。 */
export function placeSlashInWindow(args: {
  caret: SlashCaret
  menu: SlashBox
  viewport: SlashViewport
  gap?: number
  padding?: number
}) {
  const gap = args.gap ?? GAP
  const pad = args.padding ?? PAD
  const { caret, menu, viewport } = args
  const spaceBelow = viewport.height - pad - caret.bottom - gap
  const spaceAbove = caret.top - pad - gap
  const openAbove = spaceBelow < menu.height && spaceAbove > spaceBelow
  const maxHeight = Math.max(120, Math.min(menu.height, openAbove ? spaceAbove : spaceBelow, 420))
  const height = Math.min(menu.height, maxHeight)
  let top = openAbove ? caret.top - gap - height : caret.bottom + gap
  let left = caret.left
  const maxTop = Math.max(pad, viewport.height - height - pad)
  const maxLeft = Math.max(pad, viewport.width - menu.width - pad)
  top = Math.min(Math.max(top, pad), maxTop)
  left = Math.min(Math.max(left, pad), maxLeft)
  return {
    left,
    top,
    maxHeight,
    placement: openAbove ? ('top-start' as const) : ('bottom-start' as const),
  }
}
