import { test } from 'vitest'
import assert from 'node:assert/strict'
import { ensureViews, loadViews, persistViews, viewCount, viewsKey } from './view-store.ts'

test('ensureViews seeds one default view and viewCount reads it', () => {
  localStorage.removeItem(viewsKey('/pages'))
  assert.equal(loadViews('/pages').length, 0)
  assert.equal(viewCount('/pages'), 1)
  assert.equal(ensureViews('/pages')[0]?.name, '默认视图')
  persistViews('/pages', [
    ...ensureViews('/pages'),
    {
      id: '2',
      name: '副本',
      mode: 'table',
      sortField: 'id',
      sortDir: 'asc',
      filters: {},
      columns: [],
    },
  ])
  assert.equal(viewCount('/pages'), 2)
})
