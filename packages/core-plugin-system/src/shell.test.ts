import { test } from 'vitest'
import assert from 'node:assert/strict'
import { centeredGeom, declaredStoreShell, parseStoreShell, storeShellFromRecord, windowOuterSize } from './shell.ts'

test('parseStoreShell defaults and clamps declared content size', () => {
  const d = parseStoreShell(undefined)
  assert.equal(d.width, 480)
  assert.equal(d.height, 360)
  assert.equal(d.resizable, true)
  const game = parseStoreShell({ width: 640, height: 480, resizable: false })
  assert.equal(game.width, 640)
  assert.equal(game.height, 480)
  assert.equal(game.resizable, false)
  const tiny = parseStoreShell({ width: 12, height: 12, minWidth: 12, minHeight: 12 })
  assert.equal(tiny.width, 80)
  assert.equal(tiny.minWidth, 80)
})

test('windowOuterSize matches declared content size', () => {
  const shell = parseStoreShell({ width: 640, height: 480 })
  const size = windowOuterSize(shell, { w: 1600, h: 900 })
  assert.equal(size.w, 640)
  assert.equal(size.h, 480)
  const fitted = windowOuterSize(shell, { w: 400, h: 300 })
  assert.equal(fitted.w, 400)
  assert.equal(fitted.h, 300)
})

test('centeredGeom keeps the window on screen', () => {
  const geom = centeredGeom(parseStoreShell({ width: 640, height: 400 }), { w: 1200, h: 800 }, '')
  assert.equal(geom.w, 640)
  assert.equal(geom.h, 400)
  assert.ok(geom.x >= 16)
  assert.ok(geom.y >= 16)
})

test('storeShellFromRecord reads flattened plugin list fields', () => {
  const fromFlat = storeShellFromRecord({
    id: 'store-gomoku',
    shellWidth: 360,
    shellHeight: 520,
    shellMinWidth: 360,
    shellMinHeight: 520,
    shellResizable: false,
  })
  assert.equal(fromFlat.width, 360)
  assert.equal(fromFlat.height, 520)
  assert.equal(fromFlat.resizable, false)
  const nested = storeShellFromRecord({ shell: { width: 640, height: 480 } })
  assert.equal(nested.width, 640)
  assert.equal(nested.height, 480)
  const missing = storeShellFromRecord({ id: 'x' })
  assert.equal(missing.width, 480)
  assert.equal(missing.height, 360)
})

test('declaredStoreShell is true only when width and height are set', () => {
  assert.equal(declaredStoreShell(undefined), false)
  assert.equal(declaredStoreShell({}), false)
  assert.equal(declaredStoreShell({ width: 640 }), false)
  assert.equal(declaredStoreShell({ width: 640, height: 480 }), true)
})
