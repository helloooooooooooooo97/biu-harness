import { test } from 'vitest'
import assert from 'node:assert/strict'
import { APP_MODULES, isAgentPath, moduleById, moduleIdFromPath } from './app-modules.ts'

test('APP_MODULES lists agent first and includes dashboard without workspace', () => {
  assert.equal(APP_MODULES[0]?.id, 'agent')
  assert.equal(moduleById('dashboard').path, '/dashboard')
  assert.ok(APP_MODULES.some((item) => item.id === 'dashboard'))
  assert.equal(APP_MODULES.length, 2)
})

test('moduleIdFromPath maps agent and dashboard routes', () => {
  assert.equal(moduleIdFromPath('/'), 'agent')
  assert.equal(moduleIdFromPath('/s/abc'), 'agent')
  assert.equal(moduleIdFromPath('/s/abc/trajectory'), 'agent')
  assert.equal(moduleIdFromPath('/s/abc/debug'), 'agent')
  assert.equal(moduleIdFromPath('/dashboard'), 'dashboard')
  assert.equal(moduleIdFromPath('/dashboard/'), 'dashboard')
  assert.equal(isAgentPath('/s/x'), true)
  assert.equal(isAgentPath('/dashboard'), false)
})
