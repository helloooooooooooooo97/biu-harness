import { test } from 'vitest'
import assert from 'node:assert/strict'
import { builtinCatalogViewId } from '../catalog-views.ts'
import { defaultViewId, viewForPath } from './view-storage.ts'
import { VIEWS_COLLECTION_PATH } from './database-path.ts'

test('views collection defaults to the builtin catalog for itself', () => {
  assert.equal(defaultViewId(VIEWS_COLLECTION_PATH), builtinCatalogViewId(VIEWS_COLLECTION_PATH))
  assert.equal(viewForPath(VIEWS_COLLECTION_PATH, 'builtin:/events')?.filters.tablePath, '/events')
})
