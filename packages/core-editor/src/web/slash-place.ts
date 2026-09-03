export type SlashCaret = { top: number; bottom: number; left: number }
export type SlashBox = { width: number; height: number }
export type SlashViewport = { width: number; height: number }

const GAP = 4
const PAD = 8
const MENU_HEIGHT = 420

/** 按完整菜单高度判断。下方会被窗口裁切时放到光标右上。 */
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
  const need = Math.min(MENU_HEIGHT, viewport.height - pad * 2)
  const spaceBelow = viewport.height - pad - caret.bottom - gap
  const spaceAbove = caret.top - pad - gap
  const openAbove = spaceBelow < need
  const maxHeight = Math.max(120, Math.min(need, openAbove ? spaceAbove : spaceBelow))
  const height = Math.min(Math.max(menu.height, need), maxHeight)
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
