import { test } from 'vitest'
import assert from 'node:assert/strict'
import { inspectorPanelMatches, inspectorViewProps, resolveInspectorTab } from './inspector-panels.ts'

test('inspector only offers session panels when a session is selected', () => {
  const extra = { centerKinds: ['session'], requiresSession: true }
  assert.equal(inspectorPanelMatches(extra, 's1'), true)
  assert.equal(inspectorPanelMatches(extra, null), false)
})

test('page panels never appear in the session inspector', () => {
  assert.equal(inspectorPanelMatches({ centerKinds: ['collection-view', 'record'] }, 's1'), false)
  assert.equal(inspectorPanelMatches({ centerKinds: ['task'] }, 's1'), false)
  assert.equal(inspectorPanelMatches({ common: true, action: 'add-view' }, 's1'), false)
  assert.equal(inspectorPanelMatches({ common: true }, 's1'), false)
})

test('inspector does not auto-open the first available tab', () => {
  assert.equal(resolveInspectorTab('', ['script', 'reports']), '')
  assert.equal(resolveInspectorTab('script', ['script', 'reports']), '')
  assert.equal(resolveInspectorTab('gone', ['script', 'reports']), '')
})

test('inspector selects a hanging tab instead of showing an empty pane', () => {
  assert.equal(resolveInspectorTab('', ['script', 'reports'], ['reports', 'script']), 'reports')
  assert.equal(resolveInspectorTab('gone', ['script', 'reports'], ['script']), 'script')
  assert.equal(resolveInspectorTab('script', ['script', 'reports'], ['script']), 'script')
  assert.equal(resolveInspectorTab('database::a1', ['database'], ['database::a1']), 'database::a1')
})

test('legacy untagged panels stay out of the inspector', () => {
  assert.equal(inspectorPanelMatches({}, 's1'), false)
  assert.equal(inspectorPanelMatches({ requiresSession: true }, null), false)
  assert.equal(inspectorPanelMatches({ requiresSession: true }, 's1'), true)
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
    repeatable: true,
  })
  assert.deepEqual(next, { paneId: 'x' })
})
