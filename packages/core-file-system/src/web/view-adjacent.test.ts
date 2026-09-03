import { test } from 'vitest'
import assert from 'node:assert/strict'
import { findViewNeighbor, indexOnPage, neighborIndex, pageOfIndex } from './view-adjacent.ts'

test('neighborIndex walks the filtered view and stops at the ends', () => {
  assert.equal(neighborIndex(0, -1, 3), null)
  assert.equal(neighborIndex(0, 1, 3), 1)
  assert.equal(neighborIndex(2, 1, 3), null)
  assert.equal(pageOfIndex(49, 50), 0)
  assert.equal(pageOfIndex(50, 50), 1)
  assert.equal(indexOnPage('b', [{ id: 'a' }, { id: 'b' }], 1, 50), 51)
})

test('findViewNeighbor follows list order across pages', async () => {
  const ids = ['a', 'b', 'c', 'd', 'e']
  const list = async ({ offset, limit }: { offset: number; limit: number }) => ({
    items: ids.slice(offset, offset + limit).map((id) => ({ id })),
    total: ids.length,
  })
  const query = { path: '/pages' }
  const next = await findViewNeighbor({
    currentId: 'b',
    delta: 1,
    items: [{ id: 'a' }, { id: 'b' }],
    page: 0,
    pageSize: 2,
    total: 5,
    query,
    list,
  })
  assert.deepEqual(next, { id: 'c', page: 1, row: { id: 'c' } })
  const prev = await findViewNeighbor({
    currentId: 'c',
    delta: -1,
    items: [{ id: 'c' }, { id: 'd' }],
    page: 1,
    pageSize: 2,
    total: 5,
    query,
    list,
  })
  assert.deepEqual(prev, { id: 'b', page: 0, row: { id: 'b' } })
  const samePage = await findViewNeighbor({
    currentId: 'a',
    delta: 1,
    items: [{ id: 'a' }, { id: 'b' }],
    page: 0,
    pageSize: 2,
    total: 5,
    query,
    list,
  })
  assert.equal(samePage?.id, 'b')
  assert.equal(samePage?.page, 0)
  const first = await findViewNeighbor({
    currentId: 'a',
    delta: -1,
    items: [{ id: 'a' }, { id: 'b' }],
    page: 0,
    pageSize: 2,
    total: 5,
    query,
    list,
  })
  assert.equal(first, null)
})

test('findViewNeighbor locates a record that is not on the current page', async () => {
  const ids = ['a', 'b', 'c', 'd']
  const list = async ({ offset, limit }: { offset: number; limit: number }) => ({
    items: ids.slice(offset, offset + limit).map((id) => ({ id })),
    total: ids.length,
  })
  const hit = await findViewNeighbor({
    currentId: 'd',
    delta: -1,
    items: [{ id: 'a' }, { id: 'b' }],
    page: 0,
    pageSize: 2,
    total: 4,
    query: { path: '/pages' },
    list,
  })
  assert.equal(hit?.id, 'c')
  assert.equal(hit?.page, 1)
})
