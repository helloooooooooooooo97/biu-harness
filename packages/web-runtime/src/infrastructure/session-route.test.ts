import { test } from 'vitest'
import assert from 'node:assert/strict'
import { buildAppPath, isKnownAppPath, parseAppPath, routeFromState } from './session-route.ts'
import type { AppModule } from './app-modules.ts'

const plugins: AppModule[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { id: 'tasks', label: 'Tasks', path: '/tasks' },
  { id: 'channels', label: '频道', path: '/channels' },
]

test('parseAppPath covers home, session, and registered plugin modules', () => {
  assert.deepEqual(parseAppPath('/'), { kind: 'home' })
  assert.deepEqual(parseAppPath('/s/abc'), { kind: 'session', sessionId: 'abc', view: 'chat' })
  assert.deepEqual(parseAppPath('/s/abc/debug'), {
    kind: 'session',
    sessionId: 'abc',
    view: 'debug',
  })
  assert.deepEqual(parseAppPath('/dashboard', plugins), {
    kind: 'module',
    moduleId: 'dashboard',
    path: '/dashboard',
  })
  assert.deepEqual(parseAppPath('/tasks', plugins), { kind: 'module', moduleId: 'tasks', path: '/tasks' })
  assert.deepEqual(parseAppPath('/channels', plugins), {
    kind: 'module',
    moduleId: 'channels',
    path: '/channels',
  })
  assert.deepEqual(parseAppPath('/unknown'), { kind: 'home' })
  assert.deepEqual(parseAppPath('/tasks'), { kind: 'home' })
})

test('isKnownAppPath only accepts builtins plus registered plugin paths', () => {
  assert.equal(isKnownAppPath('/'), true)
  assert.equal(isKnownAppPath('/dashboard'), false)
  assert.equal(isKnownAppPath('/dashboard', plugins), true)
  assert.equal(isKnownAppPath('/tasks', plugins), true)
  assert.equal(isKnownAppPath('/channels', plugins), true)
  assert.equal(isKnownAppPath('/workspace'), false)
  assert.equal(isKnownAppPath('/s/abc'), true)
  assert.equal(isKnownAppPath('/unknown'), false)
})

test('buildAppPath round-trips with parseAppPath', () => {
  const routes = [
    { kind: 'home' as const },
    { kind: 'session' as const, sessionId: 's1', view: 'chat' as const },
    { kind: 'session' as const, sessionId: 's1', view: 'debug' as const },
    { kind: 'module' as const, moduleId: 'dashboard' as const, path: '/dashboard' },
    { kind: 'module' as const, moduleId: 'tasks' as const, path: '/tasks' },
  ]
  for (const route of routes) {
    assert.deepEqual(parseAppPath(buildAppPath(route), plugins), route)
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
