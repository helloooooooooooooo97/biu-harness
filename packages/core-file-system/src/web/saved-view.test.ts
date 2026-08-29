import { test } from 'vitest'
import assert from 'node:assert/strict'
import { normalizeSavedView, viewStateKey, type SavedView } from './saved-view.ts'

const base: SavedView = {
  id: '1',
  name: '默认',
  mode: 'table',
  sortField: 'title',
  sortDir: 'asc',
  filters: {},
  columns: ['title', 'status'],
}

test('normalizeSavedView fills view config defaults', () => {
  const next = normalizeSavedView({ id: '1', name: 'a', mode: 'graph' as SavedView['mode'], sortField: '', sortDir: 'asc', filters: {}, columns: [] })
  assert.equal(next.mode, 'table')
  assert.equal(next.sortField, 'id')
  assert.equal(next.tree, true)
  assert.equal(next.truncate, true)
  assert.equal(next.wrap, false)
  assert.equal(next.query, '')
  assert.equal(next.pageSize, 50)
})

test('viewStateKey ignores name and treats missing query as empty', () => {
  const a = normalizeSavedView({ ...base, name: 'A', query: '' })
  const b = normalizeSavedView({ ...base, name: 'B' })
  assert.equal(viewStateKey(a), viewStateKey(b))
  assert.notEqual(viewStateKey(a), viewStateKey({ ...a, sortDir: 'desc' }))
})
