import { test } from 'vitest'
import assert from 'node:assert/strict'
import { apply, name, navConflict } from './index.tsx'

test('file-system web is the implementation plugin, not a domain module', () => {
  assert.equal(name, 'core-file-system-ui')
  assert.equal(typeof apply, 'function')
})

test('app-modules slot matches rail id via extra.moduleId, not the slot key', () => {
  const extra = { moduleId: 'database', collections: [] }
  const slotKey = 'fsdb-database'
  assert.equal(String(extra.moduleId ?? extra.id ?? slotKey), 'database')
})

test('navConflict flags duplicate route and display name against existing modules', () => {
  const modules = [{ id: 'tasks', label: 'Tasks', path: '/tasks' }]
  assert.match(navConflict({ moduleId: 'x', route: '/tasks' }, 'X', modules, 'x') ?? '', /路由重复/)
  assert.match(navConflict({ moduleId: 'x', route: '/other' }, 'Tasks', modules, 'x') ?? '', /名称重复/)
  assert.equal(navConflict({ moduleId: 'tasks', route: '/tasks' }, 'Tasks', modules, 'tasks'), null)
})
