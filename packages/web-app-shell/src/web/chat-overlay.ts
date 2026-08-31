/** 聊天列窄于此时自动弹出覆盖对话框（px）。不自动收回。 */
export const CHAT_OVERLAY_ENTER = 420
export const SIDEBAR_MAX = 360
/** 默认就是能正常看会话名的宽度，不是图标细条。 */
export const SIDEBAR_DEFAULT = 240
/** 再窄就整栏关掉；最小宽度仍是正常侧栏（有会话名），不会压成图标轨。 */
export const SIDEBAR_MIN = 160
/** 到这个宽度就显示文字标签（会话名、「添加聊天」等）。 */
export const SIDEBAR_LABEL_AT = SIDEBAR_MIN
/** 拉到侧栏最大宽度才显示会话 tag（日报、总结、+N 等）。 */
export const SIDEBAR_TAG_AT = SIDEBAR_MAX
/** 中间列最窄约为对话内容最大宽 768 的 2/3，好让左右栏先完整显示。 */
export const CENTER_MIN = 512
export const INSPECTOR_MIN = 240
const RAIL = 0
const SIDEBAR = SIDEBAR_MAX

/** 低于最小宽度则 0（整栏消失）；否则夹在 [MIN, MAX]。 */
export function clampSidebarWidth(width: number) {
  const n = Math.round(Number(width))
  if (!Number.isFinite(n) || n < SIDEBAR_MIN) return 0
  return Math.min(SIDEBAR_MAX, n)
}

/** 窄屏时先整栏关掉左侧（不要压成细条），再压检查器（不低于 INSPECTOR_MIN），最后才压中间。 */
export function allocateShellColumns(opts: {
  viewportWidth: number
  railWidth?: number
  leftPane: boolean
  leftWidth?: number
  inspectorOpen: boolean
  inspectorWidth: number
}) {
  const rail = opts.railWidth ?? RAIL
  const available = Math.max(0, opts.viewportWidth - rail)
  let left = opts.leftPane ? clampSidebarWidth(opts.leftWidth ?? SIDEBAR_MAX) : 0
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
    leftPane: true,
    leftWidth: opts.sidebarCollapsed ? 0 : SIDEBAR_MAX,
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
let overlayThread = false
const listeners = new Set<() => void>()
const autohideListeners = new Set<() => void>()
const pinListeners = new Set<() => void>()
const threadListeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

function emitAutohide() {
  for (const fn of autohideListeners) fn()
}

function emitPin() {
  for (const fn of pinListeners) fn()
}

function emitThread() {
  for (const fn of threadListeners) fn()
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
  if (!next) {
    setOverlayAutohide(false)
    setOverlayThread(false)
  }
  emit()
}

export function getOverlayThread() {
  return overlayThread
}

export function subscribeOverlayThread(fn: () => void) {
  threadListeners.add(fn)
  return () => {
    threadListeners.delete(fn)
  }
}

export function setOverlayThread(next: boolean) {
  if (overlayThread === next) return
  overlayThread = next
  emitThread()
}

export function requestComposerFocus() {
  const fire = () => window.dispatchEvent(new Event('biu:composer-focus'))
  fire()
  requestAnimationFrame(fire)
  window.setTimeout(fire, 40)
}

/** 选取对象后弹出输入条：工具栏 + 统计 + 输入框，回复区等发出去再展开。 */
export function openOverlayComposer(opts?: { revealThread?: boolean }) {
  setChatOverlay(true)
  setOverlayAutohide(false)
  setOverlayThread(Boolean(opts?.revealThread))
  requestComposerFocus()
}

export function revealOverlayThread() {
  if (!overlay) return
  setOverlayThread(true)
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
    if (hit && (root.contains(hit) || hit.closest('[data-testid="chat-overlay-panel"]') || hit.closest('[data-os-dock]'))) return true
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
    const shell = document.querySelector('[data-testid="app-shell"]')
    const col = shell ? Number.parseFloat(getComputedStyle(shell).getPropertyValue('--sidebar-col')) : NaN
    const sidebarCollapsed = !Number.isFinite(col) || col < SIDEBAR_MIN
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

if (typeof window !== 'undefined') {
  window.addEventListener('biu:pick-attached', () => {
    openOverlayComposer({ revealThread: false })
  })
}
