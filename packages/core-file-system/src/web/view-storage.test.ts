import { test } from 'vitest'
import assert from 'node:assert/strict'
import { isViewStarred, loadStarredViews, persistStarredViews, toggleStarredView } from './view-storage.ts'

test('toggleStarredView stars a view, not a whole table', () => {
  const next = toggleStarredView([], '/pages', 'v1')
  assert.deepEqual(next, [{ path: '/pages', viewId: 'v1' }])
  assert.equal(isViewStarred(next, '/pages', 'v1'), true)
  assert.equal(isViewStarred(next, '/pages', 'v2'), false)
  assert.deepEqual(toggleStarredView(next, '/pages', 'v1'), [])
  persistStarredViews([{ path: '/tasks', viewId: 'a' }])
  assert.deepEqual(loadStarredViews(), [{ path: '/tasks', viewId: 'a' }])
})
