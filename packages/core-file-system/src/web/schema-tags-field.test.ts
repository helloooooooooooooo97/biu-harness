import { test } from 'vitest'
import assert from 'node:assert/strict'
import { addFacetField, loadFacets, persistFacets } from './facet-catalog.ts'

test('addFacetField appends an atomic field onto an existing facet pack', () => {
  persistFacets([{ id: 'dp', label: '动态规划', fields: [] }])
  assert.equal(addFacetField('dp', '复杂度', 'string'), true)
  const facet = loadFacets().find((item) => item.id === 'dp')
  assert.equal(facet?.fields[0]?.label, '复杂度')
  assert.equal(facet?.fields[0]?.type, 'string')
  assert.equal(addFacetField('missing', 'x', 'string'), false)
})
