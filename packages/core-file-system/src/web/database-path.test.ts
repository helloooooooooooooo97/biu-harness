import { test } from 'vitest'
import assert from 'node:assert/strict'
import { parseAppPath } from '@biu/web-session-view'
import { DATA_MODULE, databaseRecordPath, databaseViewPath } from './database-path.ts'

const plugins = [DATA_MODULE]

test('view and record helpers match the database URL scheme', () => {
  assert.equal(databaseViewPath('/pages', 'default'), '/database/pages/view/default')
  assert.equal(databaseRecordPath('/pages', 'rec-1'), '/database/pages/record/rec-1')
  assert.equal(parseAppPath(databaseViewPath('/pages', 'default'), plugins).kind, 'collection-view')
  assert.equal(parseAppPath(databaseRecordPath('/pages', 'rec-1'), plugins).kind, 'record')
})
