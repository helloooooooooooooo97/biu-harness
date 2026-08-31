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

test('user and system collection sections fold independently', () => {
  const sidebar = readFileSync(resolve(import.meta.dirname, './data-sidebar.tsx'), 'utf8')
  assert.match(sidebar, /const \[userOpen, setUserOpen\] = useState\(true\)/)
  assert.match(sidebar, /const \[systemOpen, setSystemOpen\] = useState\(true\)/)
  assert.match(sidebar, /onClick=\{\(\) => setUserOpen\(\(prev\) => !prev\)\}/)
  assert.match(sidebar, /onClick=\{\(\) => setSystemOpen\(\(prev\) => !prev\)\}/)
  assert.doesNotMatch(sidebar, /aria-expanded=\{dataOpen\}/)
  assert.doesNotMatch(sidebar, /\{dataOpen \?/)
})

test('table and view rows only expand from the fold column', () => {
  const sidebar = readFileSync(resolve(import.meta.dirname, './data-sidebar.tsx'), 'utf8')
  const css = readFileSync(resolve(import.meta.dirname, '../../../../web/style.css'), 'utf8')
  assert.match(sidebar, /onOpenTable\?\.\(table\.path, builtinAllViewId\(table\.path\)\)/)
  assert.doesNotMatch(sidebar, /catalog: true/)
  const page = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  assert.doesNotMatch(page, /opts\?\.catalog/)
  assert.match(page, /go\(\{ collection: path, viewId: viewId \?\? builtinAllViewId\(path\) \}\)/)
  assert.doesNotMatch(page, /recordsPath=\{recordsPath\}/)
  assert.doesNotMatch(page, /isCollectionHub/)
  assert.doesNotMatch(page, /go\(\{ collection: path, viewId: viewId \?\? defaultViewId\(path\) \}\)/)
  assert.match(sidebar, /setUserOpen/)
  assert.match(sidebar, /setSystemOpen/)
  assert.doesNotMatch(sidebar, /onClick=\{\(\) => setDataOpen/)
  assert.doesNotMatch(sidebar, /useState<Record<string, boolean>>\(\(\) => \(\{ \[table\.path\]: true \}\)\)/)
  assert.doesNotMatch(sidebar, /setOpenTables\(\(prev\) => \(\{ \.\.\.prev, \[path\]: true \}\)\)/)
  assert.match(sidebar, /用户数据/)
  assert.match(sidebar, /系统数据/)
  assert.match(sidebar, /data-testid="sidebar-user-collections"/)
  assert.match(sidebar, /data-testid="sidebar-system-collections"/)
  assert.match(sidebar, /data-collection-kind/)
  assert.match(sidebar, /isSystemCollection/)
  assert.match(sidebar, /className="sidebar-add"/)
  assert.match(sidebar, /onAddView\(table\.path\)/)
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
  assert.match(browser, /data-testid="record-title-split"/)
  assert.match(browser, /showRecordInInspector\(collectionPath, row.id\)/)
  assert.match(browser, /className="tasks-title-open"/)
  assert.match(browser, /tasks-title-aside/)
  assert.match(browser, /tasks-tree-count/)
  assert.match(browser, /kidCount/)
  assert.match(browser, /tasks-tree-toggle is-empty/)
  assert.match(browser, /openRow\(row\)/)
  assert.match(browser, /catalogRowOpenTarget/)
  assert.match(browser, /onOpenTable\?\.\(target\.collection, target\.viewId\)/)
  assert.doesNotMatch(browser, /recordPick\(row\)\} onClick=\{\(\) => setDetailId\(row\.id\)\}/)
})

test('deletable tables can pick rows and bulk-delete next to refresh', () => {
  assert.match(browser, /data-testid="fsdb-bulk-delete"/)
  assert.match(browser, /kind: 'delete-records'/)
  assert.match(browser, /className="fsdb-row-check"/)
  assert.match(browser, /const canDelete = Boolean\(schema\?\.records\?\.delete\)/)
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
  assert.match(css, /\.fsdb-create-btn\{[^}]*border-radius:4px/)
  assert.match(css, /\.fsdb-create-btn\{[^}]*background:var\(--dsw-pick/)
  assert.match(css, /\.fsdb-boolbox\.is-on\{[^}]*background:var\(--dsw-pick/)
  assert.match(browser, /persistViewDisplay/)
  assert.match(browser, /withViewDisplay/)
  assert.doesNotMatch(browser, /if \(current\?\.builtin\) return/)
  assert.match(css, /\.tasks-table\.is-wrap\{[^}]*white-space:normal/)
  assert.match(css, /\.tasks-table th,\.fsdb-page \.tasks-table\.is-wrap th\{[^}]*white-space:nowrap/)
  assert.match(css, /\.tasks-th\{[^}]*white-space:nowrap/)
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
  assert.match(style, /\.fsdb-main > \.fsdb-detail-title-row\{[^}]*flex:none/)
  assert.match(style, /\.fsdb-detail-main\{[^}]*padding:20px 24px 24px/)
  assert.match(style, /\.fsdb-main\{[^}]*padding:20px 24px 16px/)
  assert.match(style, /\.fsdb-main\{[^}]*max-width:var\(--dsw-chat-max-width\)/)
  assert.match(style, /\.fsdb-detail-main\{[^}]*max-width:var\(--dsw-chat-max-width\)/)
  assert.match(style, /\.fsdb-detail-title\{[^}]*font-size:32px/)
  assert.match(browser, /<h1 className="fsdb-detail-title">\{title\}<\/h1>/)
  assert.match(browser, /<TableGlyph icon=\{currentTable\?\.view\?\.icon\}/)
  assert.match(detail, /<DetailTitleIcon/)
  assert.match(detail, /recordPreviewEmoji\(selected\)/)
  assert.match(detail, /tableIcon=\{tableIcon\}/)
  assert.match(detail, /writePatch\(selected, \{ emoji: next \}\)/)
  assert.match(detail, /fsdb:change/)
  assert.match(browser, /tableIcon=\{currentTable\?\.view\?\.icon\}/)
  assert.match(detail, /data-testid=\{`fsdb-pane-\$\{pane\.id\}`\}/)
  assert.match(style, /\.fsdb-fileview\{[^}]*min-height:0/)
  assert.match(style, /\.fsdb-fileview\{[^}]*max-height:none/)
  assert.match(style, /\.fsdb-fileview\{[^}]*overflow:visible/)
  assert.match(style, /\.fsdb-fileview-pre\{[^}]*overflow:visible/)
  assert.match(style, /\.fsdb-fileview-pre\{[^}]*max-height:none/)
  assert.match(style, /\.fsdb-fileview-img\{[^}]*max-height:none/)
  assert.match(style, /\.fsdb-right-body\{[^}]*overflow:auto/)
  assert.match(style, /\.fsdb-detail-split\{[^}]*overflow:visible/)
  assert.doesNotMatch(style, /\.fsdb-fileview-pre\{[^}]*overflow:auto/)
  assert.doesNotMatch(style, /\.fsdb-fileview\{[^}]*min-height:240px/)
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

test('database inspector tab has a close control beside crumb expand', () => {
  const tab = readFileSync(resolve(import.meta.dirname, './inspector-database.tsx'), 'utf8')
  assert.match(tab, /onClose\?: \(\) => void/)
  assert.match(tab, /data-testid="inspector-tab-close"/)
  assert.match(tab, /inspector-crumb-close/)
  assert.match(tab, /XMarkIcon/)
  assert.match(tab, /inspector-crumb-actions/)
  assert.match(tab, /data-testid="inspector-crumb-toggle"/)
})
