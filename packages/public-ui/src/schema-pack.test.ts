import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('schema pack UI lives in public-ui', () => {
  const src = readFileSync(resolve(import.meta.dirname, './schema-pack.tsx'), 'utf8')
  assert.match(src, /function TagPicker/)
  assert.match(src, /function SchemaChips/)
  assert.match(src, /function AddProperty/)
  assert.match(src, /placeholder=""/)
  assert.doesNotMatch(src, /placeholder=\{selected\.length/)
  assert.doesNotMatch(src, /搜索 SuperTag/)
  assert.doesNotMatch(src, /SuperTag 是工作区全局的/)
})
