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

test('normalizeSavedView keeps custom mode slugs and rejects junk', () => {
  const graph = normalizeSavedView({ id: '1', name: 'a', mode: 'graph', sortField: '', sortDir: 'asc', filters: {}, columns: [] })
  assert.equal(graph.mode, 'graph')
  const board = normalizeSavedView({ id: '1', name: 'a', mode: 'board', sortField: '', sortDir: 'asc', filters: {}, columns: [] })
  assert.equal(board.mode, 'table')
  const junk = normalizeSavedView({ id: '1', name: 'a', mode: '???' as SavedView['mode'], sortField: '', sortDir: 'asc', filters: {}, columns: [] })
  assert.equal(junk.mode, 'table')
  assert.equal(junk.sortField, 'id')
  assert.equal(junk.tree, true)
  assert.equal(junk.truncate, true)
  assert.equal(junk.wrap, false)
  assert.equal(junk.query, '')
  assert.equal(junk.pageSize, 50)
})

test('viewStateKey ignores name and treats missing query as empty', () => {
  const a = normalizeSavedView({ ...base, name: 'A', query: '' })
  const b = normalizeSavedView({ ...base, name: 'B' })
  assert.equal(viewStateKey(a), viewStateKey(b))
  assert.notEqual(viewStateKey(a), viewStateKey({ ...a, sortDir: 'desc' }))
})
