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

test('database page no longer registers collection shortcuts on the dock', () => {
  const page = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  assert.doesNotMatch(page, /DATA_DOCK_TOOLS/)
  assert.doesNotMatch(page, /data:\$\{item\.path\}/)
  assert.doesNotMatch(page, /databaseAllViewPath\(item.path\)/)
  assert.match(page, /builtinAllViewId\(parsed.collection\)/)
  assert.doesNotMatch(page, /isCollectionHub/)
})

test('collection browser renders extra views registered for that path', () => {
  const browser = readFileSync(resolve(import.meta.dirname, './browser.tsx'), 'utf8')
  const ui = readFileSync(resolve(import.meta.dirname, './database-ui.ts'), 'utf8')
  assert.match(ui, /registerView\(path: string, view: CollectionViewType\)/)
  assert.match(browser, /dbUi\?\.views\(collectionPath\)/)
  assert.match(browser, /<customView\.View/)
  assert.match(browser, /collectionPath=\{collectionPath\}/)
  assert.match(browser, /SchemaChips/)
  const schemaUi = readFileSync(resolve(import.meta.dirname, './schema-field.tsx'), 'utf8')
  assert.match(schemaUi, /选择或新建/)
  assert.doesNotMatch(schemaUi, /搜索 SuperTag/)
  assert.doesNotMatch(schemaUi, /SuperTag 是工作区全局的/)
  assert.doesNotMatch(schemaUi, /任意表都能搜到/)
  assert.doesNotMatch(schemaUi, /选择或新建 SuperTag/)
})
