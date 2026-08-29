import { test } from 'vitest'
import assert from 'node:assert/strict'
import { inspectorPanelMatches } from './inspector-panels.ts'

test('session-only panels stay on chat and hide on database/task', () => {
  const extra = { centerKinds: ['session'], requiresSession: true }
  assert.equal(inspectorPanelMatches(extra, 'session', 's1'), true)
  assert.equal(inspectorPanelMatches(extra, 'session', null), false)
  assert.equal(inspectorPanelMatches(extra, 'record', 's1'), false)
  assert.equal(inspectorPanelMatches(extra, 'collection-view', 's1'), false)
  assert.equal(inspectorPanelMatches(extra, 'task', 's1'), false)
})

test('record panes only appear when a record is the center', () => {
  const extra = { centerKinds: ['record'] }
  assert.equal(inspectorPanelMatches(extra, 'record', null), true)
  assert.equal(inspectorPanelMatches(extra, 'collection-view', null), false)
  assert.equal(inspectorPanelMatches(extra, 'session', 's1'), false)
})

test('task inspector only appears on the tasks module', () => {
  const extra = { centerKinds: ['task'] }
  assert.equal(inspectorPanelMatches(extra, 'task', null), true)
  assert.equal(inspectorPanelMatches(extra, 'session', 's1'), false)
  assert.equal(inspectorPanelMatches(extra, 'record', null), false)
})

test('legacy untagged panels stay off session and database centers', () => {
  assert.equal(inspectorPanelMatches({}, 'session', 's1'), false)
  assert.equal(inspectorPanelMatches({}, 'record', null), false)
  assert.equal(inspectorPanelMatches({ requiresSession: true }, 'session', 's1'), true)
  assert.equal(inspectorPanelMatches({ requiresSession: true }, 'task', 's1'), false)
})
