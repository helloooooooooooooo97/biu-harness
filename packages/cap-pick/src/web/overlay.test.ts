import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const overlay = readFileSync(resolve(import.meta.dirname, './overlay.tsx'), 'utf8')

test('pick capture does not eat sidebar, rail, or inspector chrome clicks', () => {
  assert.match(overlay, /function ignorePickCapture/)
  assert.match(overlay, /\.app-side-bar/)
  assert.match(overlay, /\.app-rail/)
  assert.match(overlay, /data-biu-ignore/)
  assert.doesNotMatch(overlay, /\.session-inspector/)
})
