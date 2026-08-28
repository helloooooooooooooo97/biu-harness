/** 聊天列窄于此时自动弹出覆盖对话框（px）。不自动收回。 */
export const CHAT_OVERLAY_ENTER = 420
const RAIL = 48
const SIDEBAR = 280

export function chatColumnWidth(opts: {
  viewportWidth: number
  inspectorOpen: boolean
  inspectorWidth: number
  sidebarCollapsed: boolean
}) {
  const side = opts.sidebarCollapsed ? 0 : SIDEBAR
  const inspector = opts.inspectorOpen ? opts.inspectorWidth : 0
  return Math.max(0, opts.viewportWidth - RAIL - side - inspector)
}

/** 放大聊天：把检查器收到能给聊天列至少 ENTER 宽度。 */
export function inspectorWidthForExpandedChat(opts: {
  viewportWidth: number
  inspectorWidth: number
  sidebarCollapsed: boolean
}) {
  const side = opts.sidebarCollapsed ? 0 : SIDEBAR
  const maxInspector = opts.viewportWidth - RAIL - side - CHAT_OVERLAY_ENTER
  return Math.min(opts.inspectorWidth, Math.max(240, Math.round(maxInspector)))
}

let overlay = false
let autohide = false
let resizing = false
let hideTimer: ReturnType<typeof setTimeout> | null = null
export const OVERLAY_AUTOHIDE_DELAY_MS = 500
const listeners = new Set<() => void>()
const autohideListeners = new Set<() => void>()

function clearHideTimer() {
  if (!hideTimer) return
  clearTimeout(hideTimer)
  hideTimer = null
}

function emit() {
  for (const fn of listeners) fn()
}

function emitAutohide() {
  for (const fn of autohideListeners) fn()
}

export function getChatOverlay() {
  return overlay
}

export function subscribeChatOverlay(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function setChatOverlay(next: boolean) {
  if (overlay === next) return
  overlay = next
  if (!next) setOverlayAutohide(false)
  emit()
}

export function getOverlayAutohide() {
  return autohide
}

export function subscribeOverlayAutohide(fn: () => void) {
  autohideListeners.add(fn)
  return () => {
    autohideListeners.delete(fn)
  }
}

export function setOverlayAutohide(next: boolean) {
  clearHideTimer()
  if (autohide === next) return
  autohide = next
  emitAutohide()
}

export function setOverlayResizing(next: boolean) {
  resizing = next
  if (next) clearHideTimer()
}

export function scheduleOverlayAutohide(delay = OVERLAY_AUTOHIDE_DELAY_MS) {
  if (!overlay || resizing) return
  clearHideTimer()
  hideTimer = setTimeout(() => {
    hideTimer = null
    if (!overlay || resizing) return
    if (autohide) return
    autohide = true
    emitAutohide()
  }, delay)
}

export function requestInspectorWidth(width: number) {
  window.dispatchEvent(new CustomEvent('biu:inspector-width', { detail: width }))
}

export function requestInspectorOpen() {
  window.dispatchEvent(new Event('biu:inspector-open'))
}

export const OVERLAY_CHAT_HEIGHT_MIN = 96
export const OVERLAY_CHAT_HEIGHT_DEFAULT = 200

export function clampOverlayChatHeight(height: number, viewportHeight = 800) {
  const max = Math.max(OVERLAY_CHAT_HEIGHT_MIN, Math.round(viewportHeight * 0.7))
  if (!Number.isFinite(height)) return OVERLAY_CHAT_HEIGHT_DEFAULT
  return Math.min(max, Math.max(OVERLAY_CHAT_HEIGHT_MIN, Math.round(height)))
}
