import { test } from 'vitest'
import assert from 'node:assert/strict'
import { buildAppPath, parseAppPath, routeFromState } from './session-route.ts'

test('parseAppPath covers home, session chat, trajectory, and workspace module', () => {
  assert.deepEqual(parseAppPath('/'), { kind: 'home' })
  assert.deepEqual(parseAppPath('/s/abc'), { kind: 'session', sessionId: 'abc', view: 'chat' })
  assert.deepEqual(parseAppPath('/s/abc/'), { kind: 'session', sessionId: 'abc', view: 'chat' })
  assert.deepEqual(parseAppPath('/s/abc/chat'), { kind: 'session', sessionId: 'abc', view: 'chat' })
  assert.deepEqual(parseAppPath('/s/abc/trajectory'), {
    kind: 'session',
    sessionId: 'abc',
    view: 'trajectory',
  })
  assert.deepEqual(parseAppPath('/workspace'), { kind: 'module', moduleId: 'workspace' })
  assert.deepEqual(parseAppPath('/unknown'), { kind: 'home' })
})

test('buildAppPath round-trips with parseAppPath', () => {
  const routes = [
    { kind: 'home' as const },
    { kind: 'session' as const, sessionId: 's1', view: 'chat' as const },
    { kind: 'session' as const, sessionId: 's1', view: 'trajectory' as const },
    { kind: 'module' as const, moduleId: 'workspace' as const },
  ]
  for (const route of routes) {
    assert.deepEqual(parseAppPath(buildAppPath(route)), route)
  }
})

test('routeFromState maps sessionView fields', () => {
  assert.deepEqual(routeFromState(null, 'chat'), { kind: 'home' })
  assert.deepEqual(routeFromState('x', 'trajectory'), {
    kind: 'session',
    sessionId: 'x',
    view: 'trajectory',
  })
})
