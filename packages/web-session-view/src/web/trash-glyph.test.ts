import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

test('trash glyph is a solid can without inner slits', () => {
  const src = readFileSync(resolve(import.meta.dirname, './trash-glyph.tsx'), 'utf8')
  assert.match(src, /fill="currentColor"/)
  assert.match(src, /<path d=/)
  assert.doesNotMatch(src, /clipRule/)
  assert.doesNotMatch(src, /6\.05 6a\.75/)
})
