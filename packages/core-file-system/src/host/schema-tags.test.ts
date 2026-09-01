import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SchemaTagsStore } from './schema-tags.ts'

test('SchemaTagsStore keeps SuperTag packs in sqlite and drops nested schema types', () => {
  const store = new SchemaTagsStore()
  store.replace([
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
  const tags = store.list()
  assert.equal(tags.length, 1)
  assert.equal(tags[0]?.id, 'dp')
  assert.deepEqual(tags[0]?.fields.map((field) => field.key), ['complexity'])
  assert.equal(store.list('动态').length, 1)
  assert.equal(store.list('nope').length, 0)
})

test('sqlite file round-trips SuperTag catalog and stamp index', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fs-supertag-'))
  const path = join(dir, 'file-system.sqlite')
  const store = new SchemaTagsStore()
  store.open(path)
  store.replace([{ id: 'dp', label: '动态规划', fields: [{ key: 'complexity', type: 'string' }] }])
  store.indexRecord('/pages', 'home', '首页', ['dp'])
  store.indexRecord('/notes', 'n1', '草稿', ['dp'])

  const again = new SchemaTagsStore()
  again.open(path)
  assert.equal(again.list()[0]?.label, '动态规划')
  const collected = again.collect('动态规划')
  assert.equal(collected.tag?.id, 'dp')
  assert.deepEqual(collected.items.map((item) => item.path).sort(), ['/notes/n1', '/pages/home'])
  assert.equal(again.stampedIds('/pages', 'dp').has('home'), true)
  assert.equal(again.stampCounts().dp, 2)
  again.upsert({ id: 'dp', label: 'DP', fields: [{ key: 'complexity', type: 'string' }] })
  assert.equal(again.get('dp')?.label, 'DP')
  assert.equal(again.removeTag('dp'), true)
  assert.equal(again.list().length, 0)
})
