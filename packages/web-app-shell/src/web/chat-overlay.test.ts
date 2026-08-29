import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  chatColumnWidth,
  inspectorWidthForExpandedChat,
  CHAT_OVERLAY_ENTER,
  getChatOverlay,
  setChatOverlay,
  getOverlayAutohide,
  setOverlayAutohide,
  requestOverlayAutohide,
  setOverlayResizing,
  setOverlayPinned,
  clampOverlayChatHeight,
  OVERLAY_CHAT_HEIGHT_MIN,
} from './chat-overlay.ts'

test('chat column subtracts rail, sidebar and inspector', () => {
  assert.equal(
    chatColumnWidth({ viewportWidth: 1440, inspectorOpen: true, inspectorWidth: 800, sidebarCollapsed: false }),
    1440 - 280 - 800,
  )
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

test('overlay store set/get', () => {
  setChatOverlay(false)
  assert.equal(getChatOverlay(), false)
  setChatOverlay(true)
  assert.equal(getChatOverlay(), true)
  setChatOverlay(false)
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
