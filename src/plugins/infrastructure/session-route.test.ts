import { test } from 'vitest'
import assert from 'node:assert/strict'
import { buildAppPath, isKnownAppPath, parseAppPath, routeFromState } from './session-route.ts'

test('parseAppPath covers home, session chat, debug, dashboard, and workspace module', () => {
  assert.deepEqual(parseAppPath('/'), { kind: 'home' })
  assert.deepEqual(parseAppPath('/s/abc'), { kind: 'session', sessionId: 'abc', view: 'chat' })
  assert.deepEqual(parseAppPath('/s/abc/'), { kind: 'session', sessionId: 'abc', view: 'chat' })
  assert.deepEqual(parseAppPath('/s/abc/chat'), { kind: 'session', sessionId: 'abc', view: 'chat' })
  assert.deepEqual(parseAppPath('/s/abc/debug'), {
    kind: 'session',
    sessionId: 'abc',
    view: 'debug',
  })
  assert.deepEqual(parseAppPath('/s/abc/trajectory'), {
    kind: 'session',
    sessionId: 'abc',
    view: 'debug',
  })
  assert.deepEqual(parseAppPath('/dashboard'), { kind: 'module', moduleId: 'dashboard' })
  assert.deepEqual(parseAppPath('/workspace'), { kind: 'module', moduleId: 'workspace' })
  assert.deepEqual(parseAppPath('/unknown'), { kind: 'home' })
})

test('isKnownAppPath accepts app surfaces and rejects noise', () => {
  assert.equal(isKnownAppPath('/'), true)
  assert.equal(isKnownAppPath('/dashboard'), true)
  assert.equal(isKnownAppPath('/workspace'), true)
  assert.equal(isKnownAppPath('/s/abc'), true)
  assert.equal(isKnownAppPath('/s/abc/chat'), true)
  assert.equal(isKnownAppPath('/s/abc/debug'), true)
  assert.equal(isKnownAppPath('/s/abc/trajectory'), true)
  assert.equal(isKnownAppPath('/unknown'), false)
  assert.equal(isKnownAppPath('/s/abc/extra'), false)
})

test('buildAppPath round-trips with parseAppPath', () => {
  const routes = [
    { kind: 'home' as const },
    { kind: 'session' as const, sessionId: 's1', view: 'chat' as const },
    { kind: 'session' as const, sessionId: 's1', view: 'debug' as const },
    { kind: 'module' as const, moduleId: 'dashboard' as const },
    { kind: 'module' as const, moduleId: 'workspace' as const },
  ]
  for (const route of routes) {
    assert.deepEqual(parseAppPath(buildAppPath(route)), route)
  }
})

test('routeFromState maps sessionView fields', () => {
  assert.deepEqual(routeFromState(null, 'chat'), { kind: 'home' })
  assert.deepEqual(routeFromState('x', 'debug'), {
    kind: 'session',
    sessionId: 'x',
    view: 'debug',
  })
})
