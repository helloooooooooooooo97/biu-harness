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
  assert.match(browser, /biu:toggle-shell-sidebar/)
  assert.match(sidebar, /shell-module-sidebar/)
})

test('table and view rows only expand from the fold column', () => {
  const sidebar = readFileSync(resolve(import.meta.dirname, './data-sidebar.tsx'), 'utf8')
  const css = readFileSync(resolve(import.meta.dirname, '../../../../web/style.css'), 'utf8')
  assert.match(sidebar, /onOpenTable\?\.\(table\.path, undefined, \{ catalog: true \}\)/)
  assert.match(sidebar, /\{ catalog: true \}/)
  const page = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  assert.match(page, /if \(opts\?\.catalog\) \{\s*go\(\{ collection: path \}\)/)
  assert.match(page, /go\(\{ collection: path, viewId \}\)/)
  assert.match(page, /recordsPath=\{recordsPath\}/)
  assert.match(page, /isCollectionHub/)
  assert.doesNotMatch(page, /go\(\{ collection: path, viewId: viewId \?\? defaultViewId\(path\) \}\)/)
  assert.doesNotMatch(sidebar, /\[table\.path\]: true/)
  assert.doesNotMatch(sidebar, /setOpenTables\(\(prev\) => \(\{ \.\.\.prev, \[path\]: true \}\)\)/)
  assert.match(css, /\.sidebar-group-fold:hover \.sidebar-group-fold-chevron/)
  assert.doesNotMatch(css, /\.chat-session-row:hover \.sidebar-group-fold-chevron/)
})

test('sidebar records paint detail immediately without reloading the view', () => {
  const sidebar = readFileSync(resolve(import.meta.dirname, './data-sidebar.tsx'), 'utf8')
  const css = readFileSync(resolve(import.meta.dirname, '../../../../web/style.css'), 'utf8')
  assert.match(browser, /flushSync\(\(\) => \{\s*setOpenDetailId\(recordId\)/)
  assert.match(browser, /if \(row\) setDetailRow\(row\)/)
  assert.match(browser, /onOpenRecord\?\.\(recordId, view\.id, path\)/)
  assert.doesNotMatch(browser, /if \(path === collectionPath\) applyView\(view\)/)
  assert.doesNotMatch(browser, /onOpenRecord=\{\(path, view, recordId\) => \{\s*selectView/)
  assert.match(browser, /!detailId \?/)
  assert.match(sidebar, /onOpenRecord\?\.\(row\.id, row\)/)
  assert.match(sidebar, /event.stopPropagation\(\)/)
  assert.match(sidebar, /function RecordEmojiBoard/)
  assert.match(sidebar, /className="fsdb-emoji-picker is-fixed"/)
  assert.match(sidebar, /fsdb-record-emoji/)
  assert.match(css, /\.fsdb-emoji-picker \{[^}]*border:\s*0/s)
  assert.match(css, /\.fsdb-emoji-picker \{[^}]*background:\s*#191919/s)
})

test('table title opens record from the title-side button', () => {
  assert.match(browser, /data-testid="record-title-open"/)
  assert.match(browser, /className="tasks-title-open"/)
  assert.match(browser, /tasks-title-aside/)
  assert.match(browser, /tasks-tree-count/)
  assert.match(browser, /kidCount/)
  assert.match(browser, /tasks-tree-toggle is-empty/)
  assert.doesNotMatch(browser, /recordPick\(row\)\} onClick=\{\(\) => setDetailId\(row\.id\)\}/)
})

test('create record sits at the right of the toolbar with a blue label', () => {
  assert.match(browser, /className="fsdb-create-btn"/)
  assert.match(browser, /新建记录/)
  assert.match(browser, /<PlusIcon[\s\S]*新建/)
  assert.doesNotMatch(
    browser,
    /className="tasks-toolbar-left"[\s\S]*?aria-label="新建记录"[\s\S]*?className="tasks-toolbar-right"/,
  )
  const css = readFileSync(resolve(import.meta.dirname, './fsdb-style.ts'), 'utf8')
  assert.match(css, /\.fsdb-create-btn\{[^}]*background:#4B90F6/)
})

test('filesystem header expands the shared left sidebar and toggles the right inspector', () => {
  assert.match(browser, /cordis\.sidebar\.collapsed/)
  assert.match(browser, /!viewsOpen \?/)
  assert.match(browser, /data-testid="header-sidebar-expand"/)
  assert.match(browser, /biu:expand-shell-sidebar/)
  assert.match(browser, /data-testid="fsdb-inspector-toggle"/)
  assert.match(browser, /biu:inspector-toggle/)
  assert.match(
    browser,
    /inspectorOpen \?\s*\(\s*<ChevronDoubleRightIcon[\s\S]*:\s*\(\s*<ChevronDoubleLeftIcon/,
  )
})

test('database extras sit after the record detail, not in the inspector', () => {
  const page = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  const style = readFileSync(resolve(import.meta.dirname, './fsdb-style.ts'), 'utf8')
  assert.doesNotMatch(page, /biu:inspector-open/)
  assert.match(page, /slots\.place\('inspector-panels'/)
  assert.match(page, /view\?\.inspector/)
  assert.match(page, /seedCollection: path/)
  assert.match(page, /tabLabel: current\?\.view\?\.title/)
  assert.doesNotMatch(page, /tabLabel: '数据库'/)
  assert.doesNotMatch(page, /RecordPanePanel/)
  assert.match(detail, /fsdb-detail-extras/)
  assert.match(detail, /<h1 className="fsdb-detail-title">/)
  assert.doesNotMatch(detail, /<h2 className="fsdb-detail-title-input">/)
  assert.match(style, /\.fsdb-page:not\(\.inspector-database-page\) \.fsdb-detail-main\{[^}]*padding:80px 24px 24px/)
  assert.match(style, /\.fsdb-detail-main\{[^}]*padding:20px 24px 24px/)
  assert.match(style, /\.fsdb-main\{[^}]*padding:12px 24px 16px/)
  assert.match(style, /\.fsdb-detail-title\{[^}]*font-size:32px/)
  assert.match(detail, /data-testid=\{`fsdb-pane-\$\{pane\.id\}`\}/)
  assert.match(style, /\.fsdb-fileview\{[^}]*min-height:240px/)
  assert.match(style, /\.fsdb-fileview\{[^}]*max-height:none/)
  assert.match(style, /\.fsdb-fileview\{[^}]*overflow:visible/)
  assert.match(style, /\.fsdb-fileview-pre\{[^}]*overflow:visible/)
  assert.match(style, /\.fsdb-fileview-pre\{[^}]*max-height:none/)
  assert.match(style, /\.fsdb-fileview-img\{[^}]*max-height:none/)
  assert.doesNotMatch(style, /\.fsdb-fileview-pre\{[^}]*overflow:auto/)
  assert.doesNotMatch(style, /\.fsdb-fileview-img\{[^}]*max-height:420px/)
  assert.match(browser, /embed \?/)
  assert.doesNotMatch(browser, /setRecordFocus/)
})

test('inspector embed does not poll the collection every 20s', () => {
  assert.match(browser, /const timer = embed/)
  assert.match(browser, /}, 20000\)/)
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

test('row actions reload even when updatedAt is unchanged', () => {
  assert.match(browser, /function recordsFingerprint\(rows/)
  assert.match(browser, /return JSON.stringify\(rows\)/)
  assert.match(browser, /quietUntil\.current = 0\s*\n\s*await reload\(\)/)
})

test('inspector no longer listens for add/copy view actions', () => {
  assert.doesNotMatch(browser, /biu:inspector-action/)
  assert.doesNotMatch(browser, /detail === 'add-view'/)
  assert.doesNotMatch(browser, /detail === 'copy-view'/)
})
