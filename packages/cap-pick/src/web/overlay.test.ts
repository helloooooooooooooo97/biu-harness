import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const overlay = readFileSync(resolve(import.meta.dirname, './overlay.tsx'), 'utf8')

test('pick capture does not eat sidebar, dock, or inspector chrome clicks', () => {
  assert.match(overlay, /function ignorePickCapture/)
  assert.match(overlay, /\.app-side-bar/)
  assert.match(overlay, /data-os-dock/)
  assert.match(overlay, /data-biu-ignore/)
  assert.doesNotMatch(overlay, /\.app-rail/)
  assert.doesNotMatch(overlay, /\.session-inspector/)
})

test('Command/Ctrl+Q toggles pick mode', () => {
  assert.match(overlay, /event.metaKey \|\| event.ctrlKey/)
  assert.match(overlay, /key === 'q'/)
})
