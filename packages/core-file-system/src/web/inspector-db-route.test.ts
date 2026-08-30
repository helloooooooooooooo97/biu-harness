import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  getInspectorDbPath,
  isInspectorDatabasePath,
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

test('chat routes are not seeded as inspector database paths', () => {
  setInspectorDbPath('')
  assert.equal(isInspectorDatabasePath('/s/abc'), false)
  assert.equal(isInspectorDatabasePath('/database/pages'), true)
  seedInspectorDbPath('/s/abc')
  assert.equal(getInspectorDbPath(), '')
  seedInspectorDbPath('/database/pages')
  assert.equal(getInspectorDbPath(), '/database/pages')
})

test('each inspector database pane keeps its own path', () => {
  setInspectorDbPath('database::a', '/database/pages')
  setInspectorDbPath('database::b', '/database/tasks')
  assert.equal(getInspectorDbPath('database::a'), '/database/pages')
  assert.equal(getInspectorDbPath('database::b'), '/database/tasks')
  seedInspectorDbPath('database::a', '/database/events')
  assert.equal(getInspectorDbPath('database::a'), '/database/pages')
})
