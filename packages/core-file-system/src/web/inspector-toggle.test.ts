import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const browser = readFileSync(resolve(import.meta.dirname, './browser.tsx'), 'utf8')
const detail = readFileSync(resolve(import.meta.dirname, './record-detail.tsx'), 'utf8')

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

test('sidebar records paint detail immediately without reloading the view', () => {
  const sidebar = readFileSync(resolve(import.meta.dirname, './data-sidebar.tsx'), 'utf8')
  assert.match(browser, /flushSync\(\(\) => \{\s*setOpenDetailId\(recordId\)/)
  assert.match(browser, /if \(row\) setDetailRow\(row\)/)
  assert.match(browser, /onOpenRecord\?\.\(recordId, view\.id, path\)/)
  assert.doesNotMatch(browser, /if \(path === collectionPath\) applyView\(view\)/)
  assert.doesNotMatch(browser, /onOpenRecord=\{\(path, view, recordId\) => \{\s*selectView/)
  assert.match(browser, /!detailId \?/)
  assert.match(sidebar, /onOpenRecord\?\.\(row\.id, row\)/)
  assert.match(sidebar, /event.stopPropagation\(\)/)
})

test('table title opens record from the title-side button', () => {
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

test('database extras sit after the record detail, not in the inspector', () => {
  const page = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  assert.doesNotMatch(page, /biu:inspector-open/)
  assert.doesNotMatch(page, /slots\.place\('inspector-panels'/)
  assert.doesNotMatch(page, /RecordPanePanel/)
  assert.doesNotMatch(page, /fsdb-database-browse/)
  assert.match(detail, /fsdb-detail-extras/)
  assert.match(detail, /data-testid=\{`fsdb-pane-\$\{pane\.id\}`\}/)
  assert.doesNotMatch(browser, /embed \?/)
  assert.doesNotMatch(browser, /setRecordFocus/)
})

test('switching tables does not remount the whole browser', () => {
  const page = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  assert.doesNotMatch(page, /key=\{currentPath\}/)
})

test('list polling pauses while a record is open', () => {
  assert.match(browser, /if \(detailIdRef\.current\) return/)
  assert.match(browser, /}, 20000\)/)
})

test('page collection uses a document glyph, not the table/database icon', () => {
  const glyphs = readFileSync(resolve(import.meta.dirname, './nav-glyphs.tsx'), 'utf8')
  assert.match(glyphs, /name === 'document' \|\| name === 'document-text' \|\| name === 'page'/)
  assert.match(glyphs, /<DocumentIcon/)
})

test('inspector no longer listens for add/copy view actions', () => {
  assert.doesNotMatch(browser, /biu:inspector-action/)
  assert.doesNotMatch(browser, /detail === 'add-view'/)
  assert.doesNotMatch(browser, /detail === 'copy-view'/)
})
