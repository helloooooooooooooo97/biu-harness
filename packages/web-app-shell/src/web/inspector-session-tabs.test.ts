import { test } from 'vitest'
import assert from 'node:assert/strict'
import { inspectorPanelMatches } from './inspector-panels.ts'

test('requiresSession tabs hide when no session is selected', () => {
  assert.equal(inspectorPanelMatches({ requiresSession: true }, null), false)
  assert.equal(inspectorPanelMatches({ requiresSession: true, centerKinds: ['session'] }, 'abc'), true)
})

test('repeatable database panes can be added without a session', () => {
  assert.equal(
    inspectorPanelMatches({ requiresSession: true, centerKinds: ['session'], repeatable: true }, null),
    true,
  )
  assert.equal(inspectorPanelMatches({ requiresSession: true, centerKinds: ['session'] }, null), false)
})
