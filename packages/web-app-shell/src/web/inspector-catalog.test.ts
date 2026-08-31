import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const inspector = readFileSync(resolve(import.meta.dirname, './session-inspector.tsx'), 'utf8')
const css = readFileSync(resolve(import.meta.dirname, '../../../../web/style.css'), 'utf8')

test('inspector header keeps opened tabs on top and a plus menu on the right', () => {
  assert.match(inspector, /data-testid="inspector-add"/)
  assert.match(inspector, /data-testid="inspector-add-menu"/)
  assert.match(inspector, /className="app-side-bar-head" data-biu-ignore/)
  assert.match(inspector, /PlusIcon/)
  assert.match(inspector, /inspector-empty/)
  assert.doesNotMatch(inspector, /选择要看的内容/)
  assert.doesNotMatch(inspector, /点右上角加号/)
  assert.doesNotMatch(inspector, />面板</)
  assert.doesNotMatch(inspector, /还没有打开的面板/)
  assert.match(inspector, /inspector-add-owner/)
  assert.match(inspector, /SidebarMascot/)
  assert.match(inspector, /resolveSessionMascot/)
  assert.match(inspector, /resolveInspectorTab\(current, allowedTabs, opened\)/)
  assert.match(css, /\.inspector-empty-item\s*\{[^}]*border:\s*0/s)
  assert.match(css, /\.inspector-empty-item\s*\{[^}]*background:\s*var\(--dsw-sidebar\)/s)
  assert.match(inspector, /item.Tab/)
  assert.match(inspector, /inspectorViewProps/)
})

test('plus menu can add another database tab', () => {
  assert.match(inspector, /repeatable/)
  assert.match(inspector, /nextRepeatableTabId/)
  assert.match(inspector, /slotTabId/)
  assert.match(inspector, /paneId=\{item.id\}/)
  assert.match(inspector, /paneId=\{extraActive.id\}/)
  assert.doesNotMatch(inspector, /displayTabs.find\(\(item\) => item.id === tab\)/)
  assert.match(inspector, /inspector-add-trash/)
  assert.match(inspector, /closeOpenedTab/)
  assert.match(inspector, /inspector-tab-remove-\$\{item.id\}/)
  assert.doesNotMatch(inspector, /item\.repeatable \? \(/)
  assert.match(inspector, /getInspectorCaption/)
  assert.match(inspector, /PaneLeafIcon/)
  assert.match(inspector, /createPortal/)
  assert.match(inspector, /inspector-add-menu is-fixed/)
  assert.match(css, /\.inspector-add-owner\s*\{[^}]*border-bottom:\s*1px solid var\(--dsw-border\)/s)
  assert.doesNotMatch(inspector, /添加\$\{item\.label\}/)
})

test('inspector header tabs sit on the same vertical center as the main header', () => {
  assert.match(css, /\.app-side-bar-head\s*\{[^}]*align-items:\s*center/s)
  assert.match(css, /\.inspector-tabs\s*\{[^}]*align-items:\s*center/s)
  assert.match(css, /\.inspector-tabs\s*\{[^}]*padding:\s*0/s)
  assert.doesNotMatch(css, /\.inspector-tabs\s*\{[^}]*padding-bottom:\s*8px/s)
})
