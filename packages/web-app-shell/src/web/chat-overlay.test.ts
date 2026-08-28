import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  chatColumnWidth,
  inspectorWidthForExpandedChat,
  CHAT_OVERLAY_ENTER,
  getChatOverlay,
  setChatOverlay,
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
