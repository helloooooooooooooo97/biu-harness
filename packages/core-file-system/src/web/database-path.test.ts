import { test } from 'vitest'
import assert from 'node:assert/strict'
import { parseAppPath } from '@biu/web-session-view'
import { DATA_MODULE, databaseRecordPath, databaseViewPath, isCollectionHub, viewsCatalogHref, viewsCatalogSource } from './database-path.ts'

const plugins = [DATA_MODULE]

test('view and record helpers match the database URL scheme', () => {
  assert.equal(databaseViewPath('/pages', 'default'), '/database/pages/view/default')
  assert.equal(databaseViewPath('/sessions'), '/database/sessions')
  assert.equal(databaseRecordPath('/pages', 'rec-1'), '/database/pages/record/rec-1')
  assert.equal(parseAppPath(databaseViewPath('/pages', 'default'), plugins).kind, 'collection-view')
  assert.equal(parseAppPath(databaseViewPath('/sessions'), plugins).kind, 'collection-view')
  assert.equal(parseAppPath(databaseRecordPath('/pages', 'rec-1'), plugins).kind, 'record')
})

test('table path without view or record is a collection hub', () => {
  assert.equal(isCollectionHub('/tasks'), true)
  assert.equal(isCollectionHub('/tasks', undefined, null), true)
  assert.equal(isCollectionHub('/tasks', 'v1'), false)
  assert.equal(isCollectionHub('/tasks', undefined, 'rec-1'), false)
  assert.equal(isCollectionHub('/views'), false)
})

test('views catalog href is filtered by table source', () => {
  assert.equal(
    viewsCatalogHref('/events'),
    `/database/views/view/${encodeURIComponent('builtin:/events')}?source=%2Fevents`,
  )
  assert.equal(viewsCatalogSource('?source=%2Fevents'), '/events')
  assert.equal(viewsCatalogHref('/views'), `/database/views/view/${encodeURIComponent('builtin:/views')}`)
})
