import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  getInspectorDbPath,
  seedInspectorDbPath,
  setInspectorDbPath,
} from './inspector-db-route.ts'

test('inspector database path does not overwrite after first seed', () => {
  setInspectorDbPath('')
  seedInspectorDbPath('/database/pages')
  assert.equal(getInspectorDbPath(), '/database/pages')
  seedInspectorDbPath('/database/tasks')
  assert.equal(getInspectorDbPath(), '/database/pages')
  setInspectorDbPath('/database/tasks')
  assert.equal(getInspectorDbPath(), '/database/tasks')
})
