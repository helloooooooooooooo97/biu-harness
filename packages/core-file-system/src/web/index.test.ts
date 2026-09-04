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
  assert.match(page, /applyDatabaseChannelPayload\(payload, sessionId\)/)
  assert.match(page, /sessionView/)
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
  assert.match(schemaUi, /from '@biu\/public-ui'/)
  assert.match(schemaUi, /<TagChip /)
  assert.match(schemaUi, /placeholder=""/)
  assert.doesNotMatch(schemaUi, /placeholder="属性名"/)
  assert.doesNotMatch(schemaUi, /placeholder=\{selected\.length/)
  assert.doesNotMatch(schemaUi, /超级标签/)
  assert.doesNotMatch(schemaUi, /创建 SuperTag/)
  assert.doesNotMatch(schemaUi, /没有匹配的 SuperTag/)
  assert.match(schemaUi, /<CellMulti/)
  assert.doesNotMatch(schemaUi, /function TagPicker/)
  assert.match(schemaUi, /这条合集已不在目录里/)
})

test('tag collect table lives on the record board, not as sidebar views', () => {
  const chrome = readFileSync(resolve(import.meta.dirname, './facet-chrome.tsx'), 'utf8')
  const collect = readFileSync(resolve(import.meta.dirname, './facet-collect.tsx'), 'utf8')
  const browser = readFileSync(resolve(import.meta.dirname, './browser.tsx'), 'utf8')
  const views = readFileSync(resolve(import.meta.dirname, '../catalog-views.ts'), 'utf8')
  const detail = readFileSync(resolve(import.meta.dirname, './record-detail.tsx'), 'utf8')
  assert.match(chrome, /Board: FacetCollectBoard/)
  assert.match(collect, /sheet/)
  assert.match(collect, /lockedFilters=\{\{ facetId: facetId \}\}/)
  assert.match(collect, /<CollectionBrowser/)
  assert.match(browser, /sheet\?: boolean/)
  assert.match(detail, /chrome\?\.Board/)
  assert.doesNotMatch(views, /normalized === '\/views'/)
  assert.doesNotMatch(views, /normalized === '\/facets'/)
  const viewsUi = readFileSync(resolve(import.meta.dirname, './views-chrome.ts'), 'utf8')
  assert.match(viewsUi, /openRow/)
  assert.match(viewsUi, /mergeCatalogViews/)
})
