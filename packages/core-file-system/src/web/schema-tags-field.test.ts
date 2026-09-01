import { test } from 'vitest'
import assert from 'node:assert/strict'
import { addSchemaTagField, loadSchemaTags, persistSchemaTags } from './schema-tags.ts'

test('addSchemaTagField appends an atomic field onto an existing tag pack', () => {
  persistSchemaTags([{ id: 'dp', label: '动态规划', fields: [] }])
  assert.equal(addSchemaTagField('dp', '复杂度', 'string'), true)
  const tag = loadSchemaTags().find((item) => item.id === 'dp')
  assert.equal(tag?.fields[0]?.label, '复杂度')
  assert.equal(tag?.fields[0]?.type, 'string')
  assert.equal(addSchemaTagField('missing', 'x', 'string'), false)
})
