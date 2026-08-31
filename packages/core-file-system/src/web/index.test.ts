import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { apply, name, navConflict } from './index.tsx'
import { DATA_MODULE_ID } from './database-path.ts'

test('file-system web is the implementation plugin, not a domain module', () => {
  assert.equal(name, 'core-file-system-ui')
  assert.equal(typeof apply, 'function')
})

test('shell matches the data module by extra.moduleId database', () => {
  const extra = { moduleId: DATA_MODULE_ID, tables: [] as never[] }
  const slotKey = 'fsdb-database'
  assert.equal(String(extra.moduleId ?? slotKey), 'database')
})

test('navConflict flags duplicate route and display name against existing modules', () => {
  const modules = [{ id: 'tasks', label: 'Tasks', path: '/tasks' }]
  assert.match(navConflict({ moduleId: 'x', route: '/tasks' }, 'X', modules, 'x') ?? '', /路由重复/)
  assert.match(navConflict({ moduleId: 'x', route: '/other' }, 'Tasks', modules, 'x') ?? '', /名称重复/)
  assert.equal(navConflict({ moduleId: 'tasks', route: '/tasks' }, 'Tasks', modules, 'tasks'), null)
})

test('database page registers collection shortcuts on the dock tools group', () => {
  const page = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  assert.match(page, /DATA_DOCK_TOOLS/)
  assert.match(page, /data:\$\{item\.path\}/)
  assert.match(page, /group: 'tools'/)
  assert.match(page, /databaseAllViewPath\(item.path\)/)
  assert.doesNotMatch(page, /navigate\(databaseViewPath\(item.path\)\)/)
  assert.match(page, /builtinAllViewId\(parsed.collection\)/)
  assert.doesNotMatch(page, /isCollectionHub/)
})
