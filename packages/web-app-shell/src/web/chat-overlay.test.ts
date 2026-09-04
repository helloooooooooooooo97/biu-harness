import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  chatColumnWidth,
  inspectorWidthForExpandedChat,
  allocateShellColumns,
  applyShellColumnCssVars,
  CHAT_OVERLAY_ENTER,
  CENTER_MIN,
  INSPECTOR_MIN,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  SIDEBAR_DEFAULT,
  SIDEBAR_LABEL_AT,
  SIDEBAR_TAG_AT,
  getChatOverlay,
  setChatOverlay,
  closeChatOverlay,
  getOverlayThread,
  isChatPagePath,
  openOverlayComposer,
  revealOverlayThread,
  getOverlayAutohide,
  setOverlayAutohide,
  requestOverlayAutohide,
  overlayStillHoldsPointer,
  setOverlayResizing,
  setOverlayPinned,
  clampOverlayChatHeight,
  clampOverlayWinGeom,
  defaultOverlayWinGeom,
  overlayLayoutGeom,
  parseOverlayLayout,
  readOverlayWinState,
  writeOverlayWinState,
  OVERLAY_CHAT_HEIGHT_MIN,
  OVERLAY_DOCK_CLEARANCE,
  OVERLAY_WIN_MIN_H,
  OVERLAY_WIN_MIN_W,
  inspectorTabFromEvent,
  inspectorActionFromEvent,
  requestInspectorTab,
  requestInspectorAction,
} from './chat-overlay.ts'

test('collapsed chat sidebar disappears instead of leaving a thin rail', () => {
  assert.equal(
    chatColumnWidth({ viewportWidth: 1600, inspectorOpen: true, inspectorWidth: 320, sidebarCollapsed: true }),
    1600 - 320,
  )
})

test('sidebar below min width is gone', () => {
  const gone = allocateShellColumns({
    viewportWidth: 1600,
    leftPane: true,
    leftWidth: SIDEBAR_MIN - 1,
    inspectorOpen: false,
    inspectorWidth: 320,
  })
  assert.equal(gone.left, 0)
})

test('sidebar stays a normal pane at min width, never an icon rail', () => {
  assert.equal(SIDEBAR_MIN, 160)
  assert.equal(SIDEBAR_DEFAULT, 240)
  assert.equal(SIDEBAR_LABEL_AT, SIDEBAR_MIN)
  assert.equal(SIDEBAR_TAG_AT, SIDEBAR_MAX)
  assert.ok(SIDEBAR_MIN <= SIDEBAR_DEFAULT)
  assert.ok(SIDEBAR_DEFAULT < SIDEBAR_MAX)
  const atMin = allocateShellColumns({
    viewportWidth: 1600,
    leftPane: true,
    leftWidth: SIDEBAR_MIN,
    inspectorOpen: false,
    inspectorWidth: 320,
  })
  assert.equal(atMin.left, SIDEBAR_MIN)
})

test('applyShellColumnCssVars writes grid tracks without React state', () => {
  const el = document.createElement('div')
  applyShellColumnCssVars(el, { left: 240, inspector: 320 })
  assert.equal(el.style.getPropertyValue('--sidebar-col'), '240px')
  assert.equal(el.style.getPropertyValue('--inspector-width'), '320px')
})

test('narrow viewport shrinks center and inspector first; left hides last', () => {
  const wide = allocateShellColumns({
    viewportWidth: 1600,
    leftPane: true,
    inspectorOpen: true,
    inspectorWidth: 320,
  })
  assert.equal(wide.left, SIDEBAR_MAX)
  assert.equal(wide.inspector, 320)
  assert.equal(wide.center, 1600 - SIDEBAR_MAX - 320)

  const keepLeft = allocateShellColumns({
    viewportWidth: SIDEBAR_MAX + CENTER_MIN + 320 - 100,
    leftPane: true,
    inspectorOpen: true,
    inspectorWidth: 320,
  })
  assert.equal(keepLeft.left, SIDEBAR_MAX)
  assert.equal(keepLeft.inspector, INSPECTOR_MIN)
  assert.equal(keepLeft.center, SIDEBAR_MAX + CENTER_MIN + 320 - 100 - SIDEBAR_MAX - INSPECTOR_MIN)

  const squeezeInspector = allocateShellColumns({
    viewportWidth: SIDEBAR_MAX + 200 + INSPECTOR_MIN,
    leftPane: true,
    inspectorOpen: true,
    inspectorWidth: 320,
  })
  assert.equal(squeezeInspector.left, SIDEBAR_MAX)
  assert.equal(squeezeInspector.inspector, INSPECTOR_MIN)
  assert.equal(squeezeInspector.center, 200)

  const hideLeft = allocateShellColumns({
    viewportWidth: SIDEBAR_MIN + INSPECTOR_MIN - 1,
    leftPane: true,
    inspectorOpen: true,
    inspectorWidth: 320,
  })
  assert.equal(hideLeft.left, 0)
  assert.equal(hideLeft.inspector, INSPECTOR_MIN)
  assert.equal(hideLeft.center, SIDEBAR_MIN + INSPECTOR_MIN - 1 - INSPECTOR_MIN)
})

test('center min is two thirds of the old 768; inspector shrinks before the left pane', () => {
  assert.equal(CENTER_MIN, 512)
  const keepBoth = allocateShellColumns({
    viewportWidth: SIDEBAR_MAX + 600 + 320,
    leftPane: true,
    inspectorOpen: true,
    inspectorWidth: 320,
  })
  assert.equal(keepBoth.left, SIDEBAR_MAX)
  assert.equal(keepBoth.inspector, 320)
  assert.equal(keepBoth.center, 600)
})

test('expanding chat clamps inspector so the column is at least ENTER', () => {
  const next = inspectorWidthForExpandedChat({
    viewportWidth: 1440,
    inspectorWidth: 900,
    sidebarCollapsed: false,
  })
  assert.equal(next, 1440 - SIDEBAR_MAX - CHAT_OVERLAY_ENTER)
  assert.ok(
    chatColumnWidth({
      viewportWidth: 1440,
      inspectorOpen: true,
      inspectorWidth: next,
      sidebarCollapsed: false,
    }) >= CHAT_OVERLAY_ENTER,
  )
})

test('overlay starts closed', () => {
  setChatOverlay(false)
  assert.equal(getChatOverlay(), false)
  setChatOverlay(true)
  assert.equal(getChatOverlay(), true)
  setChatOverlay(false)
})

test('chat page paths skip the overlay', () => {
  assert.equal(isChatPagePath('/'), true)
  assert.equal(isChatPagePath('/s/abc'), true)
  assert.equal(isChatPagePath('/s/abc/debug'), true)
  assert.equal(isChatPagePath('/database'), false)
  assert.equal(isChatPagePath('/tasks'), false)
})

test('pick-attached only opens; closing stays closed even if chips remain', () => {
  setChatOverlay(false)
  history.replaceState(null, '', '/database')
  window.dispatchEvent(new Event('biu:pick-attached'))
  assert.equal(getChatOverlay(), true)
  closeChatOverlay()
  assert.equal(getChatOverlay(), false)
})

test('pick-attached on the chat page focuses composer instead of overlay', () => {
  setChatOverlay(false)
  history.replaceState(null, '', '/s/session-1')
  let focused = 0
  const onFocus = () => {
    focused += 1
  }
  window.addEventListener('biu:composer-focus', onFocus)
  window.dispatchEvent(new Event('biu:pick-attached'))
  window.removeEventListener('biu:composer-focus', onFocus)
  assert.equal(getChatOverlay(), false)
  assert.ok(focused > 0)
})

test('openOverlayComposer on the chat page does not open a window', () => {
  setChatOverlay(false)
  history.replaceState(null, '', '/s/session-1')
  openOverlayComposer({ revealThread: true })
  assert.equal(getChatOverlay(), false)
})

test('pick opens a compose-only overlay; send reveals the thread', () => {
  setChatOverlay(false)
  history.replaceState(null, '', '/database')
  openOverlayComposer({ revealThread: false })
  assert.equal(getChatOverlay(), true)
  assert.equal(getOverlayThread(), false)
  assert.equal(getOverlayAutohide(), false)
  revealOverlayThread()
  assert.equal(getOverlayThread(), true)
  setChatOverlay(false)
  assert.equal(getOverlayThread(), false)
})

test('closeChatOverlay is a no-op when already closed', () => {
  setChatOverlay(false)
  let closed = 0
  const onClosed = () => {
    closed += 1
  }
  window.addEventListener('biu:overlay-closed', onClosed)
  closeChatOverlay()
  window.removeEventListener('biu:overlay-closed', onClosed)
  assert.equal(getChatOverlay(), false)
  assert.equal(closed, 0)
})

test('closing the overlay notifies pick to exit', () => {
  setChatOverlay(true)
  let closed = 0
  const onClosed = () => {
    closed += 1
  }
  window.addEventListener('biu:overlay-closed', onClosed)
  setChatOverlay(false)
  window.removeEventListener('biu:overlay-closed', onClosed)
  assert.equal(closed, 1)
})

test('autohide resets when overlay closes', () => {
  setChatOverlay(true)
  setOverlayAutohide(true)
  assert.equal(getOverlayAutohide(), true)
  setChatOverlay(false)
  assert.equal(getOverlayAutohide(), false)
})

test('overlay window geom clamps and docks to the right, vertically centered', () => {
  const def = defaultOverlayWinGeom(1280, 800)
  assert.ok(def.w >= OVERLAY_WIN_MIN_W)
  assert.ok(def.h >= OVERLAY_WIN_MIN_H)
  assert.equal(def.x, 1280 - def.w - 12)
  assert.equal(def.y, Math.round((800 - OVERLAY_DOCK_CLEARANCE - def.h) / 2))
  assert.ok(def.y + def.h <= 800 - OVERLAY_DOCK_CLEARANCE)
  const tiny = clampOverlayWinGeom({ x: -400, y: -20, w: 10, h: 10 }, 1280, 800)
  assert.equal(tiny.w, OVERLAY_WIN_MIN_W)
  assert.equal(tiny.h, OVERLAY_WIN_MIN_H)
})

test('layout presets pin the overlay to the viewport', () => {
  const prev = { x: 100, y: 80, w: 420, h: 400 }
  const bottom = overlayLayoutGeom('bottom', prev, 1280, 800)
  assert.equal(bottom.x, Math.round((1280 - 420) / 2))
  assert.equal(bottom.w, 420)
  assert.equal(bottom.y + bottom.h, 800 - OVERLAY_DOCK_CLEARANCE)
  const wide = overlayLayoutGeom('bottom', { ...prev, w: 640 }, 1600, 900)
  assert.equal(wide.x, Math.round((1600 - 640) / 2))
  assert.equal(wide.w, 640)
  const right = overlayLayoutGeom('right', prev, 1280, 800)
  assert.equal(right.x, 1280 - 420 - 12)
  assert.equal(right.h, 400)
  assert.equal(right.y, Math.round((800 - OVERLAY_DOCK_CLEARANCE - 400) / 2))
  const tall = overlayLayoutGeom('right', { ...prev, h: 560 }, 1280, 900)
  assert.equal(tall.h, 560)
  assert.equal(tall.y, Math.round((900 - OVERLAY_DOCK_CLEARANCE - 560) / 2))
})

test('saved layout recomputes when the viewport changes', () => {
  writeOverlayWinState({ x: 12, y: 12, w: 420, h: 400, layout: 'right' })
  const original = { innerWidth: window.innerWidth, innerHeight: window.innerHeight }
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
  const state = readOverlayWinState()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: original.innerWidth })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: original.innerHeight })
  assert.equal(state.layout, 'right')
  assert.equal(state.x, 1600 - state.w - 12)
  assert.equal(state.h, 400)
  assert.equal(state.y, Math.round((900 - OVERLAY_DOCK_CLEARANCE - 400) / 2))
  writeOverlayWinState({ x: 0, y: 0, w: 500, h: 360, layout: 'bottom' })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1400 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 820 })
  const bottom = readOverlayWinState()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: original.innerWidth })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: original.innerHeight })
  assert.equal(bottom.layout, 'bottom')
  assert.equal(bottom.w, 500)
  assert.equal(bottom.x, Math.round((1400 - 500) / 2))
  assert.equal(parseOverlayLayout('nope'), 'right')
  assert.equal(parseOverlayLayout('free'), 'right')
  assert.equal(parseOverlayLayout('left'), 'right')
})

test('overlay chat height clamps', () => {
  assert.equal(clampOverlayChatHeight(20, 800), OVERLAY_CHAT_HEIGHT_MIN)
  assert.equal(clampOverlayChatHeight(900, 800), 800)
})

test('autohide requires leaving and not resizing', () => {
  setChatOverlay(true)
  setOverlayAutohide(false)
  setOverlayResizing(true)
  requestOverlayAutohide()
  assert.equal(getOverlayAutohide(), false)
  setOverlayResizing(false)
  requestOverlayAutohide()
  assert.equal(getOverlayAutohide(), true)
})

test('pointer still inside overlay when relatedTarget or hit is in the panel', () => {
  const panel = document.createElement('div')
  panel.setAttribute('data-testid', 'chat-overlay-panel')
  const child = document.createElement('input')
  panel.append(child)
  document.body.append(panel)
  assert.equal(overlayStillHoldsPointer(panel, child, 0, 0), true)
  panel.remove()
})

test('autohide does not fire when overlay is pinned', () => {
  setChatOverlay(true)
  setOverlayAutohide(false)
  setOverlayResizing(false)
  setOverlayPinned(true)
  requestOverlayAutohide()
  assert.equal(getOverlayAutohide(), false)
  setOverlayPinned(false)
  requestOverlayAutohide()
  assert.equal(getOverlayAutohide(), true)
})

test('inspector tab event accepts string or { tabId }', () => {
  assert.equal(inspectorTabFromEvent(new CustomEvent('biu:inspector-tab', { detail: 'database' })), 'database')
  assert.equal(inspectorTabFromEvent(new CustomEvent('biu:inspector-tab', { detail: { tabId: 'traj' } })), 'traj')
  assert.equal(inspectorTabFromEvent(new Event('biu:inspector-tab')), undefined)
})

test('requestInspectorTab dispatches tab id', () => {
  let seen = ''
  const onTab = (event: Event) => {
    seen = inspectorTabFromEvent(event) ?? ''
  }
  window.addEventListener('biu:inspector-tab', onTab)
  requestInspectorTab('database')
  window.removeEventListener('biu:inspector-tab', onTab)
  assert.equal(seen, 'database')
})

test('requestInspectorAction dispatches tool id', () => {
  let seen = ''
  const onAction = (event: Event) => {
    seen = inspectorActionFromEvent(event) ?? ''
  }
  window.addEventListener('biu:inspector-action', onAction)
  requestInspectorAction('add-view')
  window.removeEventListener('biu:inspector-action', onAction)
  assert.equal(seen, 'add-view')
})
