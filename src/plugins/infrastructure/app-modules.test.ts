import { test } from 'vitest'
import assert from 'node:assert/strict'
import { APP_MODULES, isAgentPath, moduleById, moduleIdFromPath } from './app-modules.ts'

test('APP_MODULES lists agent first and includes tasks, channels + dashboard', () => {
  assert.equal(APP_MODULES[0]?.id, 'agent')
  assert.equal(moduleById('dashboard').path, '/dashboard')
  assert.equal(moduleById('tasks').path, '/tasks')
  assert.equal(moduleById('channels').path, '/channels')
  assert.ok(APP_MODULES.some((item) => item.id === 'dashboard'))
  assert.ok(APP_MODULES.some((item) => item.id === 'tasks'))
  assert.ok(APP_MODULES.some((item) => item.id === 'channels'))
  assert.equal(APP_MODULES.length, 4)
})

test('moduleIdFromPath maps agent, tasks channels and dashboard routes', () => {
  assert.equal(moduleIdFromPath('/'), 'agent')
  assert.equal(moduleIdFromPath('/s/abc'), 'agent')
  assert.equal(moduleIdFromPath('/s/abc/trajectory'), 'agent')
  assert.equal(moduleIdFromPath('/s/abc/debug'), 'agent')
  assert.equal(moduleIdFromPath('/tasks'), 'tasks')
  assert.equal(moduleIdFromPath('/tasks/'), 'tasks')
  assert.equal(moduleIdFromPath('/channels'), 'channels')
  assert.equal(moduleIdFromPath('/channels/'), 'channels')
  assert.equal(moduleIdFromPath('/dashboard'), 'dashboard')
  assert.equal(moduleIdFromPath('/dashboard/'), 'dashboard')
  assert.equal(isAgentPath('/s/x'), true)
  assert.equal(isAgentPath('/tasks'), false)
  assert.equal(isAgentPath('/dashboard'), false)
})
