import { test } from 'vitest'
import assert from 'node:assert/strict'
import { inspectorPanelMatches } from './inspector-panels.ts'

test('requiresSession tabs hide when no session is selected', () => {
  assert.equal(inspectorPanelMatches({ requiresSession: true }, 'session', null), false)
  assert.equal(inspectorPanelMatches({ requiresSession: true, centerKinds: ['session'] }, 'session', 'abc'), true)
})
