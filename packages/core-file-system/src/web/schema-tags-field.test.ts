import { test } from 'vitest'
import assert from 'node:assert/strict'
import { persistFacets, registerFacetFieldKey } from './facet-catalog.ts'

test('type pack fields cannot reuse file-system keys or labels', () => {
  persistFacets([{ id: 'dp', label: '动态规划', fields: [] }])
  assert.equal(registerFacetFieldKey('标签'), null)
  assert.equal(registerFacetFieldKey('facet'), null)
  assert.equal(registerFacetFieldKey('标题'), null)
  assert.equal(registerFacetFieldKey('title'), null)
  assert.equal(registerFacetFieldKey('合集'), null)
  const ok = registerFacetFieldKey('复杂度')
  assert.ok(ok)
  assert.notEqual(ok, 'facet')
})
