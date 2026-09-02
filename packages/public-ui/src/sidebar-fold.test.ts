import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

test('public-ui fold uses grid 0fr to 1fr', () => {
  const src = readFileSync(resolve(import.meta.dirname, './sidebar-fold.tsx'), 'utf8')
  assert.match(src, /function SidebarFold/)
  assert.match(src, /className=\{\`sidebar-fold\$\{open \? ' is-open' : ''\}/)
  assert.match(src, /is-animating/)
})
