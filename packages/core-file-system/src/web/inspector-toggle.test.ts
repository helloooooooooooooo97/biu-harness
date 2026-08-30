import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const browser = readFileSync(resolve(import.meta.dirname, './browser.tsx'), 'utf8')

test('data sidebar brand sits left with a collapse control on the right', () => {
  const sidebar = readFileSync(resolve(import.meta.dirname, './data-sidebar.tsx'), 'utf8')
  assert.match(sidebar, /app-side-bar-head-brand/)
  assert.match(sidebar, /data-testid="sidebar-collapse"/)
  assert.doesNotMatch(sidebar, /SidebarBrandMascot/)
  assert.match(browser, /onCollapse=\{toggleViewsOpen\}/)
})

test('table and view rows only expand from the fold column', () => {
  const sidebar = readFileSync(resolve(import.meta.dirname, './data-sidebar.tsx'), 'utf8')
  const css = readFileSync(resolve(import.meta.dirname, '../../../../web/style.css'), 'utf8')
  assert.match(sidebar, /onClick=\{\(\) => \{\s*onOpenTable\?\.\(table\.path\)/)
  assert.doesNotMatch(sidebar, /\[table\.path\]: true/)
  assert.doesNotMatch(sidebar, /setOpenTables\(\(prev\) => \(\{ \.\.\.prev, \[path\]: true \}\)\)/)
  assert.match(css, /\.sidebar-group-fold:hover \.sidebar-group-fold-chevron/)
  assert.doesNotMatch(css, /\.chat-session-row:hover \.sidebar-group-fold-chevron/)
})

test('table view opens a record only from the title-side button', () => {
  assert.match(browser, /data-testid="record-title-open"/)
  assert.match(browser, /className="tasks-title-open"/)
  assert.doesNotMatch(browser, /recordPick\(row\)\} onClick=\{\(\) => setDetailId\(row\.id\)\}/)
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
  assert.match(page, /if \(!pane.id \|\| seen.has\(pane.id\)\) continue/)
})

test('database can be added to the inspector and browsed by crumbs', () => {
  const page = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  assert.match(page, /fsdb-database-browse/)
  assert.match(page, /tabLabel: '数据库'/)
  assert.match(page, /Tab: DatabaseInspectorTab/)
  assert.match(page, /repeatable: true/)
  const browse = readFileSync(resolve(import.meta.dirname, './inspector-database.tsx'), 'utf8')
  assert.match(browse, /bindInspectorSnapshot/)
  assert.doesNotMatch(browse, /useSnapshot\?:/)
  assert.match(browse, /inspector-crumb-leaf/)
  assert.match(browse, /CrumbTrail/)
  assert.doesNotMatch(browse, /onMouseEnter/)
  assert.doesNotMatch(browse, /go\(event, \{ kind: 'root' \}\)/)
  assert.match(browse, /embed/)
  assert.match(browse, /biu:inspector-caption/)
  assert.doesNotMatch(browse, /DataSidebar/)
  assert.match(browser, /embed = false/)
})

test('switching tables does not remount the whole browser', () => {
  const page = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  assert.doesNotMatch(page, /key=\{currentPath\}/)
  const browse = readFileSync(resolve(import.meta.dirname, './inspector-database.tsx'), 'utf8')
  assert.doesNotMatch(browse, /key=\{currentPath\}/)
})

test('inspector embed does not poll the collection every 20s', () => {
  assert.match(browser, /const timer = embed/)
  assert.match(browser, /}, 20000\)/)
})

test('inspector no longer listens for add/copy view actions', () => {
  assert.doesNotMatch(browser, /biu:inspector-action/)
  assert.doesNotMatch(browser, /detail === 'add-view'/)
  assert.doesNotMatch(browser, /detail === 'copy-view'/)
})
