/** 聊天列窄于此时自动弹出覆盖对话框（px）。不自动收回。 */
export const CHAT_OVERLAY_ENTER = 420
export const SIDEBAR_MAX = 280
export const CENTER_MIN = 768
export const INSPECTOR_MIN = 240
const RAIL = 0
const SIDEBAR = SIDEBAR_MAX

/** 窄屏时先整栏关掉左侧（不要压成细条），再压检查器（不低于 INSPECTOR_MIN），最后才压中间。 */
export function allocateShellColumns(opts: {
  viewportWidth: number
  railWidth?: number
  leftPane: boolean
  inspectorOpen: boolean
  inspectorWidth: number
}) {
  const rail = opts.railWidth ?? RAIL
  const available = Math.max(0, opts.viewportWidth - rail)
  let left = opts.leftPane ? SIDEBAR_MAX : 0
  let inspector = opts.inspectorOpen ? Math.max(INSPECTOR_MIN, opts.inspectorWidth) : 0
  let center = available - left - inspector
  if (center < CENTER_MIN && left > 0) {
    center += left
    left = 0
  }
  if (center < CENTER_MIN && inspector > INSPECTOR_MIN) {
    const take = Math.min(inspector - INSPECTOR_MIN, CENTER_MIN - center)
    inspector -= take
    center += take
  }
  center = Math.max(0, available - left - inspector)
  return { left, inspector, center }
}

export function chatColumnWidth(opts: {
  viewportWidth: number
  inspectorOpen: boolean
  inspectorWidth: number
  sidebarCollapsed: boolean
}) {
  return allocateShellColumns({
    viewportWidth: opts.viewportWidth,
    leftPane: !opts.sidebarCollapsed,
    inspectorOpen: opts.inspectorOpen,
    inspectorWidth: opts.inspectorWidth,
  }).center
}

/** 放大聊天：把检查器收到能给聊天列至少 ENTER 宽度。 */
export function inspectorWidthForExpandedChat(opts: {
  viewportWidth: number
  inspectorWidth: number
  sidebarCollapsed: boolean
}) {
  const side = opts.sidebarCollapsed ? 0 : SIDEBAR
  const maxInspector = opts.viewportWidth - RAIL - side - CHAT_OVERLAY_ENTER
  return Math.min(opts.inspectorWidth, Math.max(INSPECTOR_MIN, Math.round(maxInspector)))
}

let overlay = false
let autohide = false
let resizing = false
let pinned = false
const listeners = new Set<() => void>()
const autohideListeners = new Set<() => void>()
const pinListeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

function emitAutohide() {
  for (const fn of autohideListeners) fn()
}

function emitPin() {
  for (const fn of pinListeners) fn()
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
  if (autohide === next) return
  autohide = next
  emitAutohide()
}

export function getOverlayPinned() {
  return pinned
}

export function subscribeOverlayPinned(fn: () => void) {
  pinListeners.add(fn)
  return () => {
    pinListeners.delete(fn)
  }
}

export function setOverlayPinned(next: boolean) {
  if (pinned === next) return
  pinned = next
  if (next) setOverlayAutohide(false)
  emitPin()
}

export function toggleOverlayPinned() {
  setOverlayPinned(!pinned)
}

export function setOverlayResizing(next: boolean) {
  resizing = next
}

/** 仅在未钉住、未拖高度、且指针已离开时收起。 */
/** 指针其实还在浮窗里（子节点重绘、composer 穿透）时不要收起。 */
export function overlayStillHoldsPointer(
  panel: EventTarget | null,
  related: EventTarget | null,
  clientX?: number,
  clientY?: number,
) {
  const root = panel instanceof Element ? panel : null
  if (!root) return false
  if (related instanceof Node && root.contains(related)) return true
  if (typeof clientX === 'number' && typeof clientY === 'number') {
    const hit = document.elementFromPoint(clientX, clientY)
    if (hit && (root.contains(hit) || hit.closest('[data-testid="chat-overlay-panel"]'))) return true
  }
  return false
}

export function requestOverlayAutohide() {
  if (!overlay || resizing || pinned) return
  setOverlayAutohide(true)
}

export function requestInspectorWidth(width: number) {
  window.dispatchEvent(new CustomEvent('biu:inspector-width', { detail: width }))
}

export function requestInspectorOpen() {
  window.dispatchEvent(new Event('biu:inspector-open'))
}

export function requestInspectorClose() {
  window.dispatchEvent(new Event('biu:inspector-close'))
}

export function requestInspectorTab(tabId: string) {
  if (!tabId) return
  window.dispatchEvent(new CustomEvent('biu:inspector-tab', { detail: tabId }))
}

export function requestInspectorAction(action: string) {
  if (!action) return
  window.dispatchEvent(new CustomEvent('biu:inspector-action', { detail: action }))
}

export function inspectorActionFromEvent(event: Event): string | undefined {
  const detail = (event as CustomEvent).detail
  return typeof detail === 'string' && detail ? detail : undefined
}

export function inspectorTabFromEvent(event: Event): string | undefined {
  const detail = (event as CustomEvent).detail
  if (typeof detail === 'string' && detail) return detail
  if (detail && typeof detail === 'object' && typeof (detail as { tabId?: unknown }).tabId === 'string') {
    const tabId = (detail as { tabId: string }).tabId
    return tabId || undefined
  }
  return undefined
}

export function toggleChatOverlay() {
  if (overlay) {
    let inspectorWidth = 320
    try {
      const n = Number(localStorage.getItem('cordis.inspector.width'))
      if (Number.isFinite(n) && n >= 240) inspectorWidth = n
    } catch {
      /* ignore */
    }
    const sidebarCollapsed = Boolean(document.querySelector('.app-shell-agent.is-sidebar-collapsed'))
    requestInspectorWidth(
      inspectorWidthForExpandedChat({
        viewportWidth: window.innerWidth,
        inspectorWidth,
        sidebarCollapsed,
      }),
    )
    setChatOverlay(false)
    return
  }
  requestInspectorOpen()
  setChatOverlay(true)
}

export const OVERLAY_CHAT_HEIGHT_MIN = 96
export const OVERLAY_CHAT_HEIGHT_DEFAULT = 200

export function clampOverlayChatHeight(height: number, maxHeight = 800) {
  const max = Math.max(OVERLAY_CHAT_HEIGHT_MIN, Math.round(maxHeight))
  if (!Number.isFinite(height)) return OVERLAY_CHAT_HEIGHT_DEFAULT
  return Math.min(max, Math.max(OVERLAY_CHAT_HEIGHT_MIN, Math.round(height)))
}
