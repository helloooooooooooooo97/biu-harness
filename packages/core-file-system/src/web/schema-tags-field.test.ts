import { test } from 'vitest'
import assert from 'node:assert/strict'
import { addFacetField, loadFacets, persistFacets, registerFacetFieldKey } from './facet-catalog.ts'

test('addFacetField appends an atomic field onto an existing facet pack', () => {
  persistFacets([{ id: 'dp', label: '动态规划', fields: [] }])
  assert.equal(addFacetField('dp', '复杂度', 'string'), true)
  const facet = loadFacets().find((item) => item.id === 'dp')
  assert.equal(facet?.fields[0]?.label, '复杂度')
  assert.equal(facet?.fields[0]?.type, 'string')
  assert.notEqual(facet?.fields[0]?.key, 'facet')
  assert.equal(addFacetField('missing', 'x', 'string'), false)
})

test('type pack fields cannot reuse file-system keys or labels', () => {
  persistFacets([{ id: 'dp', label: '动态规划', fields: [] }])
  assert.equal(registerFacetFieldKey('标签'), null)
  assert.equal(addFacetField('dp', '标签', 'string'), false)
  assert.equal(registerFacetFieldKey('facet'), null)
  assert.equal(registerFacetFieldKey('标题'), null)
  assert.equal(registerFacetFieldKey('title'), null)
  assert.equal(addFacetField('dp', '合集', 'string'), false)
  assert.equal(addFacetField('dp', 'facet', 'string'), false)
  assert.equal(addFacetField('dp', '复杂度', 'string'), true)
  assert.equal(addFacetField('dp', '复杂度', 'number'), false)
  assert.equal(loadFacets().find((item) => item.id === 'dp')?.fields.length, 1)
})
