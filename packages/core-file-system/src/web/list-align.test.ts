import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const css = readFileSync(resolve(import.meta.dirname, './fsdb-style.ts'), 'utf8')

test('list and detail share the chat column max width with side padding', () => {
  assert.match(css, /\.fsdb-main\{[^}]*max-width:var\(--dsw-chat-max-width\)/)
  assert.match(css, /\.fsdb-main\{[^}]*margin-inline:auto/)
  assert.match(css, /\.fsdb-main\{[^}]*padding:80px 24px 16px/)
  assert.match(css, /\.fsdb-main > \.fsdb-detail-title-row\{[^}]*flex:none/)
  assert.match(css, /\.fsdb-detail-main\{[^}]*max-width:var\(--dsw-chat-max-width\)/)
  assert.match(css, /\.fsdb-detail-main\{[^}]*margin-inline:auto/)
  assert.match(css, /\.fsdb-detail-main\{[^}]*padding:80px 24px 24px/)
  assert.doesNotMatch(css, /\.fsdb-main\{[^}]*max-width:none/)
  assert.match(css, /\.fsdb-page\.is-full-width \.fsdb-main,\.fsdb-page\.is-full-width \.fsdb-detail-main\{[^}]*max-width:none/)
  assert.match(css, /\.tasks-queue-item-body\{[^}]*flex-wrap:nowrap/)
  assert.match(css, /\.tasks-queue-item-main\{[^}]*flex:none/)
  assert.match(css, /\.tasks-queue-item-main\{[^}]*width:auto/)
  assert.match(css, /\.tasks-queue-item-main\{[^}]*overflow:visible/)
  assert.doesNotMatch(css, /flex:0 0 36%/)
  assert.match(css, /\.tasks-queue-item-body > \.fsdb-proplist\{[^}]*margin-left:0/)
  assert.match(css, /\.tasks-queue-item-body > \.fsdb-proplist\{[^}]*justify-content:flex-start/)
  assert.match(css, /\.tasks-queue-item-body > \.fsdb-proplist\{[^}]*flex-wrap:wrap/)
  assert.match(css, /\.tasks-queue-item-body > \.fsdb-proplist\{[^}]*flex:1 1 12rem/)
  assert.match(css, /\.tasks-queue-item-body > \.fsdb-proplist\{[^}]*min-width:0/)
  assert.match(css, /\.tasks-queue-item-body \.fsdb-proprow\{[^}]*white-space:nowrap/)
  assert.match(css, /\.tasks-queue-item-body \.fsdb-proprow-v\{[^}]*white-space:nowrap/)
  assert.match(css, /\.tasks-board-col\{[^}]*background:transparent/)
  assert.match(css, /\.tasks-board-col \.tasks-minicard\{[^}]*background:#202020/)
  assert.match(css, /\.fsdb-cards\{[^}]*align-items:stretch/)
  assert.match(css, /\.fsdb-cards\{[^}]*grid-auto-rows:auto/)
  assert.match(css, /\.fsdb-cards > \.tasks-minicard\{[^}]*height:100%/)
  assert.match(css, /\.tasks-viewdd-menu\{[^}]*min-width:320px/)
  assert.match(css, /\.tasks-viewtabs\{[^}]*overflow:hidden/)
  assert.match(css, /\.tasks-viewdd-item-actions\{[^}]*visibility:hidden/)
  assert.match(css, /\.tasks-viewdd-act\{[^}]*width:26px/)
})

test('list and detail properties share key and value colors', () => {
  assert.match(css, /\.fsdb-proprow-k,\.fsdb-prop>span:first-child\{[^}]*color:#7B7B79/)
  assert.match(css, /\.fsdb-proprow-v,\.fsdb-prop-val,\.fsdb-detail-id\{[^}]*color:#7C7A76/)
  assert.match(css, /\.fsdb-schema-prop-k\{[^}]*color:#7B7B79/)
})

test('usage figures in collection cells match the table font size', () => {
  assert.match(css, /\.fsdb-page \.traj-usage,\.fsdb-page \.traj-usage-empty\{[^}]*font-size:14px/)
})

test('visible column menu scrolls inside a max height', () => {
  const browser = readFileSync(resolve(import.meta.dirname, './browser.tsx'), 'utf8')
  assert.match(browser, /className="tasks-sort-menu fsdb-col-menu"/)
  assert.match(browser, /className="fsdb-col-menu-list"/)
  assert.match(css, /\.fsdb-page \.fsdb-col-menu\{[^}]*max-height:min\(60vh,360px\)/)
  assert.match(css, /\.fsdb-page \.fsdb-col-menu-list\{[^}]*overflow:auto/)
})
