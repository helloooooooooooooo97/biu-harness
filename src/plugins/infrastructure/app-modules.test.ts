import { test } from 'vitest'
import assert from 'node:assert/strict'
import { APP_MODULES, isAgentPath, moduleById, moduleIdFromPath } from './app-modules.ts'

test('APP_MODULES lists agent first', () => {
  assert.equal(APP_MODULES[0]?.id, 'agent')
  assert.equal(moduleById('workspace').path, '/workspace')
})

test('moduleIdFromPath maps agent and workspace routes', () => {
  assert.equal(moduleIdFromPath('/'), 'agent')
  assert.equal(moduleIdFromPath('/s/abc'), 'agent')
  assert.equal(moduleIdFromPath('/s/abc/trajectory'), 'agent')
  assert.equal(moduleIdFromPath('/workspace'), 'workspace')
  assert.equal(moduleIdFromPath('/workspace/'), 'workspace')
  assert.equal(isAgentPath('/s/x'), true)
  assert.equal(isAgentPath('/workspace'), false)
})
