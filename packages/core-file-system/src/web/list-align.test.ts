import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

const css = readFileSync(resolve(import.meta.dirname, './fsdb-style.ts'), 'utf8')

test('list and detail share the chat column max width with side padding', () => {
  assert.match(css, /\.fsdb-main\{[^}]*max-width:var\(--dsw-chat-max-width\)/)
  assert.match(css, /\.fsdb-main\{[^}]*margin-inline:auto/)
  assert.match(css, /\.fsdb-main\{[^}]*padding:20px 24px 16px/)
  assert.match(css, /\.fsdb-main > \.fsdb-detail-title\{[^}]*flex:none/)
  assert.match(css, /\.fsdb-detail-main\{[^}]*max-width:var\(--dsw-chat-max-width\)/)
  assert.match(css, /\.fsdb-detail-main\{[^}]*margin-inline:auto/)
  assert.match(css, /\.fsdb-detail-main\{[^}]*padding:20px 24px 24px/)
  assert.doesNotMatch(css, /\.fsdb-main\{[^}]*max-width:none/)
  assert.match(css, /\.tasks-queue-item-body\{[^}]*flex-wrap:nowrap/)
  assert.match(css, /\.tasks-queue-item-main\{[^}]*flex:1 1 12rem/)
  assert.match(css, /\.tasks-queue-item-main\{[^}]*width:auto/)
  assert.match(css, /\.tasks-queue-item-main\{[^}]*min-width:8rem/)
  assert.doesNotMatch(css, /flex:0 0 36%/)
  assert.match(css, /\.tasks-queue-item-body > \.fsdb-proplist\{[^}]*margin-left:auto/)
  assert.match(css, /\.tasks-queue-item-body > \.fsdb-proplist\{[^}]*justify-content:flex-end/)
  assert.match(css, /\.tasks-queue-item-body > \.fsdb-proplist\{[^}]*flex-wrap:wrap/)
  assert.match(css, /\.tasks-queue-item-body > \.fsdb-proplist\{[^}]*flex:1 1 12rem/)
  assert.match(css, /\.tasks-queue-item-body > \.fsdb-proplist\{[^}]*min-width:0/)
  assert.match(css, /\.tasks-queue-item-body \.fsdb-propchip\{[^}]*white-space:nowrap/)
  assert.match(css, /\.tasks-queue-item-body \.fsdb-propchip-v\{[^}]*white-space:nowrap/)
  assert.match(css, /\.tasks-board-col\{[^}]*background:#202020/)
  assert.match(css, /\.tasks-board-col \.tasks-minicard\{[^}]*background:#191919/)
  assert.match(css, /\.fsdb-cards\{[^}]*align-items:stretch/)
  assert.match(css, /\.fsdb-cards\{[^}]*grid-auto-rows:auto/)
  assert.match(css, /\.fsdb-cards > \.tasks-minicard\{[^}]*height:100%/)
})

test('usage figures in collection cells match the table font size', () => {
  assert.match(css, /\.fsdb-page \.traj-usage,\.fsdb-page \.traj-usage-empty\{[^}]*font-size:14px/)
})
