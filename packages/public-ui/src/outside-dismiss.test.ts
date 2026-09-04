import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

test('outside dismiss listens in the capture phase', () => {
  const src = readFileSync(resolve(import.meta.dirname, './outside-dismiss.ts'), 'utf8')
  const menu = readFileSync(resolve(import.meta.dirname, './anchor-menu.tsx'), 'utf8')
  assert.match(src, /addEventListener\('mousedown', onDown, true\)/)
  assert.match(src, /removeEventListener\('mousedown', onDown, true\)/)
  assert.match(menu, /listenOutsideDismiss/)
  assert.match(menu, /zIndex = 200/)
  assert.match(menu, /minWidth = 220/)
})
