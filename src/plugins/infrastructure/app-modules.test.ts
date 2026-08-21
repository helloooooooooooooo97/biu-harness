import { test } from 'vitest'
import assert from 'node:assert/strict'
import { APP_MODULES, isAgentPath, moduleById, moduleIdFromPath } from './app-modules.ts'

test('APP_MODULES lists agent first and includes dashboard', () => {
  assert.equal(APP_MODULES[0]?.id, 'agent')
  assert.equal(moduleById('workspace').path, '/workspace')
  assert.equal(moduleById('dashboard').path, '/dashboard')
  assert.ok(APP_MODULES.some((item) => item.id === 'dashboard'))
})

test('moduleIdFromPath maps agent, dashboard, and workspace routes', () => {
  assert.equal(moduleIdFromPath('/'), 'agent')
  assert.equal(moduleIdFromPath('/s/abc'), 'agent')
  assert.equal(moduleIdFromPath('/s/abc/trajectory'), 'agent')
  assert.equal(moduleIdFromPath('/s/abc/debug'), 'agent')
  assert.equal(moduleIdFromPath('/dashboard'), 'dashboard')
  assert.equal(moduleIdFromPath('/dashboard/'), 'dashboard')
  assert.equal(moduleIdFromPath('/workspace'), 'workspace')
  assert.equal(moduleIdFromPath('/workspace/'), 'workspace')
  assert.equal(isAgentPath('/s/x'), true)
  assert.equal(isAgentPath('/dashboard'), false)
  assert.equal(isAgentPath('/workspace'), false)
})
