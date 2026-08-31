import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  chatColumnWidth,
  inspectorWidthForExpandedChat,
  allocateShellColumns,
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
  OVERLAY_CHAT_HEIGHT_MIN,
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

test('narrow viewport hides the left pane outright, then shrinks inspector, then center', () => {
  const wide = allocateShellColumns({
    viewportWidth: 1600,
    leftPane: true,
    inspectorOpen: true,
    inspectorWidth: 320,
  })
  assert.equal(wide.left, SIDEBAR_MAX)
  assert.equal(wide.inspector, 320)
  assert.equal(wide.center, 1600 - SIDEBAR_MAX - 320)

  const hideLeft = allocateShellColumns({
    viewportWidth: SIDEBAR_MAX + CENTER_MIN + 320 - 100,
    leftPane: true,
    inspectorOpen: true,
    inspectorWidth: 320,
  })
  assert.equal(hideLeft.left, 0)
  assert.equal(hideLeft.inspector, 320)
  assert.equal(hideLeft.center, SIDEBAR_MAX + CENTER_MIN + 320 - 100 - 320)

  const stealInspector = allocateShellColumns({
    viewportWidth: CENTER_MIN + INSPECTOR_MIN,
    leftPane: true,
    inspectorOpen: true,
    inspectorWidth: 320,
  })
  assert.equal(stealInspector.left, 0)
  assert.equal(stealInspector.inspector, INSPECTOR_MIN)
  assert.equal(stealInspector.center, CENTER_MIN)

  const squeezeCenter = allocateShellColumns({
    viewportWidth: CENTER_MIN + INSPECTOR_MIN - 80,
    leftPane: true,
    inspectorOpen: true,
    inspectorWidth: 320,
  })
  assert.equal(squeezeCenter.left, 0)
  assert.equal(squeezeCenter.inspector, INSPECTOR_MIN)
  assert.equal(squeezeCenter.center, CENTER_MIN - 80)
})

test('center min is two thirds of the old 768 so side panes stay visible longer', () => {
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

test('pick opens a compose-only overlay; send reveals the thread', () => {
  setChatOverlay(false)
  openOverlayComposer({ revealThread: false })
  assert.equal(getChatOverlay(), true)
  assert.equal(getOverlayThread(), false)
  assert.equal(getOverlayAutohide(), false)
  revealOverlayThread()
  assert.equal(getOverlayThread(), true)
  setChatOverlay(false)
  assert.equal(getOverlayThread(), false)
})

test('closeChatOverlay notifies even if the overlay was already closed', () => {
  setChatOverlay(false)
  let closed = 0
  const onClosed = () => {
    closed += 1
  }
  window.addEventListener('biu:overlay-closed', onClosed)
  closeChatOverlay()
  window.removeEventListener('biu:overlay-closed', onClosed)
  assert.equal(getChatOverlay(), false)
  assert.equal(closed, 1)
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

test('overlay window geom clamps and sits above the dock by default', () => {
  const def = defaultOverlayWinGeom(1280, 800)
  assert.ok(def.w >= OVERLAY_WIN_MIN_W)
  assert.ok(def.h >= OVERLAY_WIN_MIN_H)
  assert.ok(def.y + def.h <= 800 - 80)
  const tiny = clampOverlayWinGeom({ x: -400, y: -20, w: 10, h: 10 }, 1280, 800)
  assert.equal(tiny.w, OVERLAY_WIN_MIN_W)
  assert.equal(tiny.h, OVERLAY_WIN_MIN_H)
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
