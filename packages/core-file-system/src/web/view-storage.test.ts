import { test } from 'vitest'
import assert from 'node:assert/strict'
import { builtinAllViewId, builtinCatalogViewId } from '../catalog-views.ts'
import { defaultViewId, viewForPath } from './view-storage.ts'
import { VIEWS_COLLECTION_PATH } from './database-path.ts'

test('views collection still resolves catalog stubs from the route', () => {
  assert.equal(viewForPath(VIEWS_COLLECTION_PATH, 'builtin:/events')?.filters.tablePath, '/events')
  assert.equal(viewForPath(VIEWS_COLLECTION_PATH, builtinCatalogViewId('/events'))?.id, builtinCatalogViewId('/events'))
})

test('tables default to the builtin 全部xx view', () => {
  assert.equal(defaultViewId('/sessions'), builtinAllViewId('/sessions'))
  assert.equal(defaultViewId(VIEWS_COLLECTION_PATH), builtinAllViewId(VIEWS_COLLECTION_PATH))
  assert.equal(viewForPath('/sessions')?.builtin, true)
  assert.deepEqual(viewForPath('/sessions')?.filters, {})
})
