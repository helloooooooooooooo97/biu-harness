import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const browser = readFileSync(resolve(import.meta.dirname, './browser.tsx'), 'utf8')

test('data sidebar brand sits left with a collapse control on the right', () => {
  const sidebar = readFileSync(resolve(import.meta.dirname, './data-sidebar.tsx'), 'utf8')
  assert.match(sidebar, /Biu Agent OS/)
  assert.match(sidebar, /data-testid="sidebar-collapse"/)
  assert.doesNotMatch(sidebar, /SidebarBrandMascot/)
  assert.match(browser, /onCollapse=\{toggleViewsOpen\}/)
})

test('filesystem header toggles the right inspector, not the left data sidebar', () => {
  assert.match(browser, /data-testid="fsdb-inspector-toggle"/)
  assert.match(browser, /biu:inspector-toggle/)
  assert.match(
    browser,
    /inspectorOpen \?\s*\(\s*<ChevronDoubleRightIcon[\s\S]*:\s*\(\s*<ChevronDoubleLeftIcon/,
  )
  assert.doesNotMatch(browser, /收起左侧边栏/)
  assert.doesNotMatch(browser, /展开左侧边栏/)
})

test('database does not auto-open inspector content; panes follow the current table', () => {
  const page = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  assert.doesNotMatch(page, /biu:inspector-open/)
  assert.match(page, /centerKinds: \['collection-view', 'record'\]/)
})

test('database can be added to the inspector and browsed by crumbs', () => {
  const page = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  assert.match(page, /fsdb-database-browse/)
  assert.match(page, /tabLabel: '数据库'/)
  assert.match(page, /Tab: DatabaseInspectorTab/)
  const browse = readFileSync(resolve(import.meta.dirname, './inspector-database.tsx'), 'utf8')
  assert.match(browse, /data-testid="inspector-database"/)
  assert.match(browse, /aria-label="数据库位置"/)
  assert.match(browse, /inspector-crumb-leaf/)
  assert.match(browse, /hideChrome/)
})

test('inspector no longer listens for add/copy view actions', () => {
  assert.doesNotMatch(browser, /biu:inspector-action/)
  assert.doesNotMatch(browser, /detail === 'add-view'/)
  assert.doesNotMatch(browser, /detail === 'copy-view'/)
})
