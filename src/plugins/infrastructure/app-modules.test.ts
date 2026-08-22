import { test } from 'vitest'
import assert from 'node:assert/strict'
import { APP_MODULES, isAgentPath, moduleById, moduleIdFromPath } from './app-modules.ts'

test('APP_MODULES lists agent first and includes tasks + dashboard', () => {
  assert.equal(APP_MODULES[0]?.id, 'agent')
  assert.equal(moduleById('dashboard').path, '/dashboard')
  assert.equal(moduleById('tasks').path, '/tasks')
  assert.ok(APP_MODULES.some((item) => item.id === 'dashboard'))
  assert.ok(APP_MODULES.some((item) => item.id === 'tasks'))
  assert.equal(APP_MODULES.length, 3)
})

test('moduleIdFromPath maps agent, tasks and dashboard routes', () => {
  assert.equal(moduleIdFromPath('/'), 'agent')
  assert.equal(moduleIdFromPath('/s/abc'), 'agent')
  assert.equal(moduleIdFromPath('/s/abc/trajectory'), 'agent')
  assert.equal(moduleIdFromPath('/s/abc/debug'), 'agent')
  assert.equal(moduleIdFromPath('/tasks'), 'tasks')
  assert.equal(moduleIdFromPath('/tasks/'), 'tasks')
  assert.equal(moduleIdFromPath('/dashboard'), 'dashboard')
  assert.equal(moduleIdFromPath('/dashboard/'), 'dashboard')
  assert.equal(isAgentPath('/s/x'), true)
  assert.equal(isAgentPath('/tasks'), false)
  assert.equal(isAgentPath('/dashboard'), false)
})
