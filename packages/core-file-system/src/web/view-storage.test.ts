import { test } from 'vitest'
import assert from 'node:assert/strict'
import { isViewStarred, loadStarredViews, loadViews, persistStarredViews, rememberViews, toggleStarredView, viewForPath, viewsKey } from './view-storage.ts'
import { normalizeSavedView } from './saved-view.ts'

test('toggleStarredView stars a view, not a whole table', () => {
  const next = toggleStarredView([], '/pages', 'v1')
  assert.deepEqual(next, [{ path: '/pages', viewId: 'v1' }])
  assert.equal(isViewStarred(next, '/pages', 'v1'), true)
  assert.equal(isViewStarred(next, '/pages', 'v2'), false)
  assert.deepEqual(toggleStarredView(next, '/pages', 'v1'), [])
  persistStarredViews([{ path: '/tasks', viewId: 'a' }])
  assert.deepEqual(loadStarredViews(), [{ path: '/tasks', viewId: 'a' }])
})

test('loadViews prefers in-memory names over stale localStorage', () => {
  const path = '/pages'
  const stale = normalizeSavedView({
    id: 'v1',
    name: '默认视图',
    mode: 'table',
    sortField: 'id',
    sortDir: 'asc',
    filters: {},
    columns: [],
  })
  localStorage.setItem(viewsKey(path), JSON.stringify([stale]))
  rememberViews(path, [{ ...stale, name: '周报' }])
  assert.equal(loadViews(path)[0]?.name, '周报')
  assert.equal(viewForPath(path)?.id, 'v1')
  assert.equal(viewForPath(path, 'missing')?.id, 'v1')
})
