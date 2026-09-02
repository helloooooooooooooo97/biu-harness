import { test } from 'vitest'
import assert from 'node:assert/strict'
import { placeSlashInWindow } from './slash-place.ts'

test('slash menu stays below when the window has room', () => {
  const placed = placeSlashInWindow({
    caret: { top: 80, bottom: 100, left: 40 },
    menu: { width: 324, height: 280 },
    viewport: { width: 1200, height: 800 },
  })
  assert.equal(placed.placement, 'bottom-start')
  assert.equal(placed.top, 104)
  assert.equal(placed.left, 40)
})

test('slash menu flips above when the window would clip the bottom', () => {
  const placed = placeSlashInWindow({
    caret: { top: 620, bottom: 640, left: 40 },
    menu: { width: 324, height: 280 },
    viewport: { width: 1200, height: 700 },
  })
  assert.equal(placed.placement, 'top-start')
  assert.ok(placed.top < 620)
  assert.ok(placed.top + placed.maxHeight <= 700)
})

test('slash menu stays inside a short window', () => {
  const placed = placeSlashInWindow({
    caret: { top: 200, bottom: 220, left: 40 },
    menu: { width: 324, height: 420 },
    viewport: { width: 1200, height: 400 },
  })
  assert.ok(placed.top >= 8)
  assert.ok(placed.top + placed.maxHeight <= 392)
})

test('slash menu uses full height so a late layout still flips near the bottom', () => {
  const placed = placeSlashInWindow({
    caret: { top: 850, bottom: 868, left: 24 },
    menu: { width: 324, height: 0 },
    viewport: { width: 1738, height: 900 },
  })
  assert.equal(placed.placement, 'top-start')
  assert.ok(placed.top < 850)
  assert.ok(placed.top + placed.maxHeight <= 900)
})
