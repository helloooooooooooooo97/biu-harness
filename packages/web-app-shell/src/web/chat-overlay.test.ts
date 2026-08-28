import { test, vi } from 'vitest'
import assert from 'node:assert/strict'
import {
  chatColumnWidth,
  inspectorWidthForExpandedChat,
  CHAT_OVERLAY_ENTER,
  getChatOverlay,
  setChatOverlay,
  getOverlayAutohide,
  setOverlayAutohide,
  scheduleOverlayAutohide,
  setOverlayResizing,
  clampOverlayChatHeight,
  OVERLAY_CHAT_HEIGHT_MIN,
  OVERLAY_AUTOHIDE_DELAY_MS,
} from './chat-overlay.ts'

test('chat column subtracts rail, sidebar and inspector', () => {
  assert.equal(
    chatColumnWidth({ viewportWidth: 1440, inspectorOpen: true, inspectorWidth: 800, sidebarCollapsed: false }),
    1440 - 48 - 280 - 800,
  )
})

test('expanding chat clamps inspector so the column is at least ENTER', () => {
  const next = inspectorWidthForExpandedChat({
    viewportWidth: 1440,
    inspectorWidth: 900,
    sidebarCollapsed: false,
  })
  assert.equal(next, 1440 - 48 - 280 - CHAT_OVERLAY_ENTER)
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
  assert.equal(clampOverlayChatHeight(900, 800), Math.round(800 * 0.7))
})

test('autohide waits 500ms and can be cancelled', () => {
  vi.useFakeTimers()
  setChatOverlay(true)
  setOverlayAutohide(false)
  scheduleOverlayAutohide()
  vi.advanceTimersByTime(OVERLAY_AUTOHIDE_DELAY_MS - 1)
  assert.equal(getOverlayAutohide(), false)
  vi.advanceTimersByTime(1)
  assert.equal(getOverlayAutohide(), true)
  setOverlayAutohide(false)
  scheduleOverlayAutohide()
  setOverlayAutohide(false)
  vi.advanceTimersByTime(OVERLAY_AUTOHIDE_DELAY_MS + 50)
  assert.equal(getOverlayAutohide(), false)
  vi.useRealTimers()
})

test('autohide does not fire while resizing', () => {
  vi.useFakeTimers()
  setChatOverlay(true)
  setOverlayAutohide(false)
  setOverlayResizing(true)
  scheduleOverlayAutohide()
  vi.advanceTimersByTime(OVERLAY_AUTOHIDE_DELAY_MS + 50)
  assert.equal(getOverlayAutohide(), false)
  setOverlayResizing(false)
  scheduleOverlayAutohide()
  vi.advanceTimersByTime(OVERLAY_AUTOHIDE_DELAY_MS)
  assert.equal(getOverlayAutohide(), true)
  vi.useRealTimers()
})
