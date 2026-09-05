import { test } from 'vitest'
import assert from 'node:assert/strict'
import { inferPackFieldType, orphanPackEntries } from './fields.ts'

test('orphan pack entries skip live fields, empties, and reserved keys', () => {
  const orphans = orphanPackEntries(
    [{ key: 'complexity' }],
    {
      complexity: 'O(n)',
      related: { tags: ['graph'], values: {} },
      facet: 'nope',
      '': 'x',
      leftover: '还在',
      blank: '  ',
    },
  )
  assert.deepEqual(
    orphans.map((item) => item.key),
    ['related', 'leftover'],
  )
  assert.equal(orphans.find((item) => item.key === 'related')?.type, 'facet')
  assert.equal(orphans.find((item) => item.key === 'leftover')?.type, 'string')
})

test('infer pack field type from leftover values', () => {
  assert.equal(inferPackFieldType(true), 'boolean')
  assert.equal(inferPackFieldType(12), 'number')
  assert.equal(inferPackFieldType(['a', 'b']), 'multi-select')
  assert.equal(inferPackFieldType('https://example.com/a'), 'url')
  assert.equal(inferPackFieldType({ tags: ['dp'], values: {} }), 'facet')
  assert.equal(inferPackFieldType('O(n)'), 'string')
})
