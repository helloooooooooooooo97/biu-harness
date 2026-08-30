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
  getChatOverlay,
  setChatOverlay,
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
  OVERLAY_CHAT_HEIGHT_MIN,
  inspectorTabFromEvent,
  inspectorActionFromEvent,
  requestInspectorTab,
  requestInspectorAction,
} from './chat-overlay.ts'

test('chat column subtracts rail, sidebar and inspector', () => {
  assert.equal(
    chatColumnWidth({ viewportWidth: 1600, inspectorOpen: true, inspectorWidth: 320, sidebarCollapsed: false }),
    1600 - SIDEBAR_MAX - 320,
  )
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

test('expanding chat clamps inspector so the column is at least ENTER', () => {
  const next = inspectorWidthForExpandedChat({
    viewportWidth: 1440,
    inspectorWidth: 900,
    sidebarCollapsed: false,
  })
  assert.equal(next, 1440 - 280 - CHAT_OVERLAY_ENTER)
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

test('autohide resets when overlay closes', () => {
  setChatOverlay(true)
  setOverlayAutohide(true)
  assert.equal(getOverlayAutohide(), true)
  setChatOverlay(false)
  assert.equal(getOverlayAutohide(), false)
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
