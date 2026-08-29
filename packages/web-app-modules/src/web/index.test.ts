import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import * as appModules from './index.ts'
import { AppModulesService, isAgentPath, moduleById, moduleIdFromPath } from './index.ts'

test('builtin list is only agent', () => {
  assert.deepEqual(
    appModules.BUILTIN_MODULES.map((item) => item.id),
    ['agent'],
  )
  assert.equal(moduleById('agent').path, '/')
  assert.equal(moduleIdFromPath('/'), 'agent')
  assert.equal(moduleIdFromPath('/s/abc'), 'agent')
  assert.equal(isAgentPath('/s/x'), true)
})

test('plugins register routes; shell does not hardcode them', async () => {
  const ctx = new Context()
  await ctx.plugin(appModules)
  const svc = ctx.appModules as AppModulesService
  svc.register({ id: 'tasks', label: 'Tasks', path: '/tasks', order: 20 })
  svc.register({ id: 'dashboard', label: 'Dashboard', path: '/dashboard', order: 80 })
  const plugins = svc.plugins()
  assert.equal(moduleIdFromPath('/tasks', plugins), 'tasks')
  assert.equal(moduleIdFromPath('/dashboard', plugins), 'dashboard')
  assert.equal(isAgentPath('/tasks', plugins), false)
  assert.equal(svc.list().map((item) => item.id).join(','), 'agent,tasks,dashboard')
  assert.equal(svc.isNavReady(), false)
  svc.markNavReady()
  assert.equal(svc.isNavReady(), true)
})
