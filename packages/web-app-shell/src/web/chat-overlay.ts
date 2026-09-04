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
/** 中间列希望至少这么宽；不够时先压检查器，不够再压左侧，不要一窄就把侧栏关掉。 */
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

/** 窄屏时先压中间、再把检查器收到 INSPECTOR_MIN；左侧尽量保持，两侧都压到顶后才收到 SIDEBAR_MIN，仍不够才整栏关掉。 */
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
  if (center < CENTER_MIN && inspector > INSPECTOR_MIN) {
    const take = Math.min(inspector - INSPECTOR_MIN, CENTER_MIN - center)
    inspector -= take
    center += take
  }
  if (center < 0 && left > SIDEBAR_MIN) {
    const take = Math.min(left - SIDEBAR_MIN, -center)
    left -= take
    center += take
  }
  if (center < 0 && left > 0) {
    center += left
    left = 0
  }
  if (center < 0 && inspector > 0) {
    const take = Math.min(inspector, -center)
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
    notifyOverlayClosed()
  }
  emit()
}

function notifyOverlayClosed() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('biu:overlay-closed'))
}

export function closeChatOverlay() {
  setChatOverlay(false)
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

let composerFocusPending = false

export function requestComposerFocus() {
  composerFocusPending = true
  const fire = () => window.dispatchEvent(new Event('biu:composer-focus'))
  fire()
  requestAnimationFrame(fire)
  window.setTimeout(fire, 40)
  window.setTimeout(() => {
    fire()
    composerFocusPending = false
  }, 160)
}

export function isComposerFocusPending() {
  return composerFocusPending
}

/** 聊天页中间已有输入框，选取不要再弹悬浮窗。 */
export function isChatPagePath(pathname: string) {
  const path = (pathname.split('?')[0] || '/').replace(/\/+$/, '') || '/'
  return path === '/' || path.startsWith('/s/')
}

/** 选取对象后弹出输入条：工具栏 + 统计 + 输入框，回复区等发出去再展开。聊天页本身已有输入框，不要再弹窗。 */
export function openOverlayComposer(opts?: { revealThread?: boolean }) {
  if (typeof window !== 'undefined' && isChatPagePath(window.location.pathname)) {
    requestComposerFocus()
    return
  }
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
  if (typeof window !== 'undefined' && isChatPagePath(window.location.pathname)) {
    requestComposerFocus()
    return
  }
  requestInspectorOpen()
  setChatOverlay(true)
}

export const OVERLAY_CHAT_HEIGHT_MIN = 96
export const OVERLAY_CHAT_HEIGHT_DEFAULT = 200

export type OverlayWinGeom = { x: number; y: number; w: number; h: number }
export type OverlayLayout = 'right' | 'bottom'
export type OverlayWinState = OverlayWinGeom & { layout: OverlayLayout }

export const OVERLAY_WIN_MIN_W = 320
export const OVERLAY_WIN_MIN_H = 280
export const OVERLAY_WIN_DEFAULT_W = 420
export const OVERLAY_WIN_DEFAULT_H = 520
export const OVERLAY_DOCK_CLEARANCE = 80
const OVERLAY_WIN_GEOM_KEY = 'cordis.overlay.geom'
const OVERLAY_MARGIN = 12

export const OVERLAY_LAYOUTS: Array<{ id: OverlayLayout; label: string }> = [
  { id: 'right', label: '右侧居中' },
  { id: 'bottom', label: '底部居中' },
]

export function parseOverlayLayout(value: unknown): OverlayLayout {
  if (value === 'bottom') return 'bottom'
  return 'right'
}

export function defaultOverlayWinGeom(vw = 1280, vh = 800): OverlayWinGeom {
  const w = Math.min(OVERLAY_WIN_DEFAULT_W, Math.max(OVERLAY_WIN_MIN_W, vw - 40))
  const h = Math.min(OVERLAY_WIN_DEFAULT_H, Math.max(OVERLAY_WIN_MIN_H, vh - OVERLAY_DOCK_CLEARANCE - 24))
  return overlayLayoutGeom('right', { x: 0, y: 0, w, h }, vw, vh)
}

export function clampOverlayWinGeom(geom: OverlayWinGeom, vw = 1280, vh = 800): OverlayWinGeom {
  const w = Math.min(vw - 24, Math.max(OVERLAY_WIN_MIN_W, Math.round(geom.w)))
  const h = Math.min(vh - 24, Math.max(OVERLAY_WIN_MIN_H, Math.round(geom.h)))
  const x = Math.min(vw - 48, Math.max(12 - (w - 48), Math.round(geom.x)))
  const y = Math.min(vh - 48, Math.max(OVERLAY_MARGIN, Math.round(geom.y)))
  return { x, y, w, h }
}

export function overlayLayoutGeom(
  layout: OverlayLayout,
  prev: OverlayWinGeom,
  vw = 1280,
  vh = 800,
): OverlayWinGeom {
  const maxW = Math.max(OVERLAY_WIN_MIN_W, vw - OVERLAY_MARGIN * 2)
  const maxH = Math.max(OVERLAY_WIN_MIN_H, vh - OVERLAY_DOCK_CLEARANCE - OVERLAY_MARGIN)
  const w = Math.min(Math.max(prev.w, OVERLAY_WIN_MIN_W), maxW)
  const h = Math.min(Math.max(prev.h, OVERLAY_WIN_MIN_H), maxH)
  if (layout === 'bottom') {
    return clampOverlayWinGeom(
      {
        w,
        h,
        x: Math.round((vw - w) / 2),
        y: vh - OVERLAY_DOCK_CLEARANCE - h,
      },
      vw,
      vh,
    )
  }
  if (layout === 'right') {
    const avail = vh - OVERLAY_DOCK_CLEARANCE
    return clampOverlayWinGeom(
      {
        w,
        h,
        x: vw - w - OVERLAY_MARGIN,
        y: Math.round(Math.max(OVERLAY_MARGIN, (avail - h) / 2)),
      },
      vw,
      vh,
    )
  }
  return clampOverlayWinGeom(prev, vw, vh)
}

export function readOverlayWinState(): OverlayWinState {
  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight
  const fallback = { ...defaultOverlayWinGeom(vw, vh), layout: 'right' as const }
  try {
    const raw = localStorage.getItem(OVERLAY_WIN_GEOM_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<OverlayWinState>
    const layout = parseOverlayLayout(parsed.layout)
    const prev = {
      x: Number(parsed.x),
      y: Number(parsed.y),
      w: Number(parsed.w),
      h: Number(parsed.h),
    }
    if (![prev.x, prev.y, prev.w, prev.h].every((n) => Number.isFinite(n))) return fallback
    const geom = overlayLayoutGeom(layout, prev, vw, vh)
    return { ...geom, layout }
  } catch {
    return fallback
  }
}

export function readOverlayWinGeom(): OverlayWinGeom {
  const { layout: _layout, ...geom } = readOverlayWinState()
  return geom
}

export function writeOverlayWinState(state: OverlayWinState): void {
  try {
    localStorage.setItem(OVERLAY_WIN_GEOM_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export function writeOverlayWinGeom(geom: OverlayWinGeom, layout: OverlayLayout = 'right'): void {
  writeOverlayWinState({ ...geom, layout })
}

export function requestOverlayFocus() {
  window.dispatchEvent(new Event('biu:overlay-focus'))
}

export function clampOverlayChatHeight(height: number, maxHeight = 800) {
  const max = Math.max(OVERLAY_CHAT_HEIGHT_MIN, Math.round(maxHeight))
  if (!Number.isFinite(height)) return OVERLAY_CHAT_HEIGHT_DEFAULT
  return Math.min(max, Math.max(OVERLAY_CHAT_HEIGHT_MIN, Math.round(height)))
}

if (typeof window !== 'undefined') {
  window.addEventListener('biu:pick-attached', () => {
    if (isChatPagePath(window.location.pathname)) {
      requestComposerFocus()
      return
    }
    openOverlayComposer({ revealThread: false })
  })
}
