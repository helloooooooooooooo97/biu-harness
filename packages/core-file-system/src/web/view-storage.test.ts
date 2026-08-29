import { test } from 'vitest'
import assert from 'node:assert/strict'
import { loadStarredTables, persistStarredTables, toggleStarredTable } from './view-storage.ts'

test('toggleStarredTable adds and removes a table path', () => {
  assert.deepEqual(toggleStarredTable([], '/pages'), ['/pages'])
  assert.deepEqual(toggleStarredTable(['/pages'], '/pages'), [])
  persistStarredTables(['/plugins'])
  assert.deepEqual(loadStarredTables(), ['/plugins'])
})
