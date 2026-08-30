import { test } from 'vitest'
import assert from 'node:assert/strict'
import { inspectorPanelMatches, inspectorViewProps, resolveInspectorTab } from './inspector-panels.ts'

test('session-only panels stay on chat and hide on database/task', () => {
  const extra = { centerKinds: ['session'], requiresSession: true }
  assert.equal(inspectorPanelMatches(extra, 'session', 's1'), true)
  assert.equal(inspectorPanelMatches(extra, 'session', null), false)
  assert.equal(inspectorPanelMatches(extra, 'record', 's1'), false)
  assert.equal(inspectorPanelMatches(extra, 'collection-view', 's1'), false)
  assert.equal(inspectorPanelMatches(extra, 'task', 's1'), false)
})

test('record panes are offered on the table and the record, not on chat', () => {
  const extra = { centerKinds: ['collection-view', 'record'] }
  assert.equal(inspectorPanelMatches(extra, 'record', null), true)
  assert.equal(inspectorPanelMatches(extra, 'collection-view', null), true)
  assert.equal(inspectorPanelMatches(extra, 'session', 's1'), false)
})

test('task inspector only appears on the tasks module', () => {
  const extra = { centerKinds: ['task'] }
  assert.equal(inspectorPanelMatches(extra, 'task', null), true)
  assert.equal(inspectorPanelMatches(extra, 'session', 's1'), false)
  assert.equal(inspectorPanelMatches(extra, 'record', null), false)
})

test('common tools stay available on every center', () => {
  const extra = { common: true, action: 'add-view' }
  assert.equal(inspectorPanelMatches(extra, 'collection-view', null), true)
  assert.equal(inspectorPanelMatches(extra, 'record', null), true)
  assert.equal(inspectorPanelMatches(extra, 'session', 's1'), true)
  assert.equal(inspectorPanelMatches(extra, 'session', null), true)
  assert.equal(inspectorPanelMatches(extra, 'module', null), true)
})

test('inspector does not auto-open the first available tab', () => {
  assert.equal(resolveInspectorTab('', ['script', 'reports']), '')
  assert.equal(resolveInspectorTab('script', ['script', 'reports']), 'script')
  assert.equal(resolveInspectorTab('gone', ['script', 'reports']), '')
})

test('legacy untagged panels stay off session and database centers', () => {
  assert.equal(inspectorPanelMatches({}, 'session', 's1'), false)
  assert.equal(inspectorPanelMatches({}, 'record', null), false)
  assert.equal(inspectorPanelMatches({ requiresSession: true }, 'session', 's1'), true)
  assert.equal(inspectorPanelMatches({ requiresSession: true }, 'task', 's1'), false)
})

test('inspector view props drop tab chrome and databaseUi', () => {
  const next = inspectorViewProps({
    tabId: 'database',
    tabLabel: '数据库',
    Tab: () => null,
    tabIcon: () => null,
    databaseUi: { boom: true },
    useSnapshot: 1,
    paneId: 'x',
  })
  assert.deepEqual(next, { useSnapshot: 1, paneId: 'x' })
})
