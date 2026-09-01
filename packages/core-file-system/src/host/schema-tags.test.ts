import { test } from 'vitest'
import assert from 'node:assert/strict'
import { SchemaTagsStore } from './schema-tags.ts'

test('SchemaTagsStore keeps atomic fields and drops nested schema types', () => {
  const store = new SchemaTagsStore()
  store.replace('/pages', [
    {
      id: 'dp',
      label: '动态规划',
      fields: [
        { key: 'complexity', type: 'string', label: '复杂度' },
        { key: 'nested', type: 'schema', label: '套一层' },
      ],
    },
    { id: '??', label: '坏的', fields: [] },
  ])
  const tags = store.list('/pages/')
  assert.equal(tags.length, 1)
  assert.equal(tags[0]?.id, 'dp')
  assert.deepEqual(tags[0]?.fields.map((field) => field.key), ['complexity'])
})
