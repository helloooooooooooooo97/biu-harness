import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const overlay = readFileSync(resolve(import.meta.dirname, './overlay.tsx'), 'utf8')

test('pick capture does not eat sidebar, inspector, or chat overlay clicks', () => {
  assert.match(overlay, /function ignorePickCapture/)
  assert.match(overlay, /\.app-side-bar/)
  assert.doesNotMatch(overlay, /data-os-dock/)
  assert.match(overlay, /data-biu-ignore/)
  assert.match(overlay, /chat-overlay-panel/)
  assert.doesNotMatch(overlay, /\.app-rail/)
  assert.doesNotMatch(overlay, /\.session-inspector/)
})

test('close button inside the chat overlay is not captured while picking', async () => {
  const { ignorePickCapture } = await import('./overlay.tsx')
  const panel = document.createElement('div')
  panel.setAttribute('data-testid', 'chat-overlay-panel')
  const close = document.createElement('button')
  close.setAttribute('data-testid', 'chat-overlay-close')
  panel.append(close)
  document.body.append(panel)
  assert.equal(ignorePickCapture(close), true)
  panel.remove()
})

test('Escape exits pick mode', () => {
  assert.match(overlay, /pick.exit\(\)/)
})

test('Escape blurs the focused control so the UA focus ring does not linger', () => {
  assert.match(overlay, /active.blur\(\)/)
})

test('pointerup prefers a text selection over object picks', () => {
  assert.match(overlay, /textPickFromSelection/)
  assert.match(overlay, /inReadable/)
  assert.match(overlay, /\.chat-stage/)
})

test('pointerup does not attach picks after pick mode has exited', () => {
  assert.match(overlay, /if \(!pick.picking\) return/)
})

test('Command/Ctrl+Q toggles pick mode', () => {
  assert.match(overlay, /event.metaKey \|\| event.ctrlKey/)
  assert.match(overlay, /key === 'q'/)
})

test('pick highlight uses the visible clipped box, not the raw layout box', () => {
  assert.match(overlay, /visiblePickBox/)
})
