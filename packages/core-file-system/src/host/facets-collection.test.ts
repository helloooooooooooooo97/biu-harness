import { test } from 'vitest'
import assert from 'node:assert/strict'
import { FacetStore } from './facets-store.ts'
import { facetsCollection } from './facets-collection.ts'

test('facetsCollection lists facets with stamp counts and supports create/update/delete', async () => {
  const store = new FacetStore()
  store.replace([{ id: 'dp', label: '动态规划', fields: [{ key: 'complexity', type: 'string' }] }])
  store.indexRecord('/pages', 'home', '首页', ['dp'])
  const spec = facetsCollection(store)
  assert.equal(spec.path, '/facets')
  assert.equal(spec.label, '合集')
  assert.equal(spec.view?.title, '合集')
  assert.equal(spec.view?.icon, 'rectangle-stack')
  const listed = await spec.list()
  assert.equal(listed.length, 1)
  assert.equal(listed[0]?.title, '动态规划')
  assert.equal(listed[0]?.fieldCount, 1)
  assert.equal(listed[0]?.stampCount, 1)

  const created = await spec.create!([{ title: 'IO' }])
  assert.equal(created[0]?.id, 'io')
  assert.equal(store.get('io')?.label, 'IO')

  const updated = await spec.update!(created[0]!.id, { title: 'I/O', fields: [{ key: 'format', type: 'string', label: '格式' }] })
  assert.equal(updated.title, 'I/O')
  assert.equal(updated.fieldCount, 1)
  assert.equal(store.get('io')?.fields[0]?.key, 'format')
  assert.equal(spec.schema.fields.fields?.writable, true)
  assert.match(String(updated.fields), /format/)

  await spec.remove!({ ids: [created[0]!.id] })
  assert.equal(store.get('io'), null)
  assert.equal((await spec.list()).length, 1)

  const specWithTables = facetsCollection(store, () => [{ id: 'pages', path: '/pages', label: '页面' }])
  const collected = await specWithTables.list({ filter: { facetId: 'dp' } })
  assert.equal(collected.length, 1)
  assert.equal(collected[0]?.id, 'pages::home')
  assert.equal(collected[0]?.table, '页面')
  assert.equal(collected[0]?.tablePath, '/pages')
  assert.equal(collected[0]?.sourceId, 'home')
  assert.equal(collected[0]?.facetId, 'dp')
})
