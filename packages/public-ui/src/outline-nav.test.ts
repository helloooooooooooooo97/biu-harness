import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

test('OutlineNav is the shared tick rail and hover panel', () => {
  const src = readFileSync(resolve(import.meta.dirname, './outline-nav.tsx'), 'utf8')
  assert.match(src, /export function OutlineNav/)
  assert.match(src, /chat-outline-tick/)
  assert.match(src, /chat-outline-panel/)
  assert.match(src, /hoverTick/)
  assert.match(src, /level\?: 1 \| 2/)
  assert.match(src, /item\.level === 2 \? ' is-h2'/)
  assert.match(src, /item\.level === 1 \? ' is-h1'/)
  assert.doesNotMatch(src, /requestChatOutlineGo/)
})
