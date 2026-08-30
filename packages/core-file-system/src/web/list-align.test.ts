import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const css = readFileSync(resolve(import.meta.dirname, './fsdb-style.ts'), 'utf8')

test('list view spans the pane and pins row meta to the right', () => {
  assert.match(css, /\.fsdb-main\{[^}]*max-width:none/)
  assert.match(css, /\.fsdb-main\{[^}]*margin-inline:0/)
  assert.doesNotMatch(css, /\.fsdb-main\{[^}]*max-width:var\(--dsw-chat-max-width\)/)
  assert.match(css, /\.tasks-queue-item-main\{[^}]*flex:1 1 auto/)
  assert.doesNotMatch(css, /flex:0 0 36%/)
  assert.match(css, /\.tasks-queue-item-body > \.fsdb-proplist\{[^}]*margin-left:auto/)
  assert.match(css, /\.tasks-queue-item-body > \.fsdb-proplist\{[^}]*justify-content:flex-end/)
})
