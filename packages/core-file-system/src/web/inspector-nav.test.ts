import { test } from 'vitest'
import assert from 'node:assert/strict'
import { parseAppPath } from '@biu/web-session-view'
import { databaseRecordPath, databaseViewPath } from './inspector-nav.ts'

const plugins = [{ id: 'database', label: '数据', path: '/database' }]

test('view and record helpers match the database URL scheme', () => {
  assert.equal(databaseViewPath('/pages', 'default'), '/database/c/pages/v/default')
  assert.equal(databaseRecordPath('/pages', 'rec-1', 'default'), '/database/c/pages/v/default/r/rec-1')
  assert.equal(parseAppPath(databaseViewPath('/pages', 'default'), plugins).kind, 'collection-view')
  assert.equal(parseAppPath(databaseRecordPath('/pages', 'rec-1'), plugins).kind, 'record')
})
