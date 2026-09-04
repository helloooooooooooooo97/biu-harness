import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

test('database-ui ships one search menu for select and multi-select', () => {
  const menu = readFileSync(resolve(import.meta.dirname, './search-menu.tsx'), 'utf8')
  const select = readFileSync(resolve(import.meta.dirname, './cell-select.tsx'), 'utf8')
  const multi = readFileSync(resolve(import.meta.dirname, './cell-multi.tsx'), 'utf8')
  assert.match(menu, /function DbSearchMenu/)
  assert.match(menu, /db-search-menu/)
  assert.match(menu, /className="db-search-field"/)
  assert.match(select, /<DbSearchMenu/)
  assert.match(multi, /<DbSearchMenu/)
  assert.match(multi, /TagChip/)
  assert.doesNotMatch(multi, /db-cell-multi-input/)
  assert.doesNotMatch(multi, /搜索或添加/)
  assert.match(select, /chips/)
  assert.match(select, /<TagChip/)
  assert.match(multi, /multiple = true/)
  assert.match(multi, /<TagChip id=\{item\.value\}/)
  assert.doesNotMatch(select, /添加「/)
  assert.doesNotMatch(select, /未选择/)
  assert.match(select, /Boolean\(item\.value\)/)
})
