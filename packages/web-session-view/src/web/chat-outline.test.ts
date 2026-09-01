import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deriveChatOutline, type ChatNode } from './index.ts'

function user(id: string, text: string, sender?: Extract<ChatNode, { kind: 'user' }>['sender']): ChatNode {
  return { id, kind: 'user', text, ...(sender ? { sender } : {}) }
}

test('deriveChatOutline can hide robot-initiated user nodes', () => {
  const nodes: ChatNode[] = [
    user('u-1', 'hello from me'),
    { id: 'r-1', kind: 'reply', parts: [], copyText: 'ok' },
    user('u-2', 'wake from live', { type: 'session', sessionId: 's-live' }),
    user('u-3', 'another human'),
  ]
  assert.deepEqual(
    deriveChatOutline(nodes, 'user').map((item) => item.id),
    ['u-1', 'u-3'],
  )
  assert.deepEqual(
    deriveChatOutline(nodes, 'all').map((item) => [item.id, item.robot]),
    [
      ['u-1', false],
      ['u-2', true],
      ['u-3', false],
    ],
  )
})

test('message outline is a left rail of ticks with a hover menu', () => {
  const css = readFileSync(resolve(import.meta.dirname, '../../../../web/style.css'), 'utf8')
  const outline = readFileSync(resolve(import.meta.dirname, '../../../cap-chat/src/web/message-outline.tsx'), 'utf8')
  const shell = readFileSync(resolve(import.meta.dirname, '../../../web-app-shell/src/web/index.tsx'), 'utf8')
  assert.match(css, /\.chat-outline\s*\{[^}]*left:\s*6px/s)
  assert.match(css, /\.chat-outline-rail\s*\{[^}]*overflow-y:\s*auto/s)
  assert.match(css, /\.chat-outline-tick::after/)
  assert.match(css, /\.chat-outline-panel\s*\{[^}]*left:\s*22px/s)
  assert.match(outline, /chat-outline-tick/)
  assert.match(outline, /hoverTick/)
  assert.match(outline, /hoverMenuItem/)
  assert.match(outline, /requestChatOutlineGo\(item\.id\)/)
  assert.doesNotMatch(outline, /chat-outline-toggle/)
  assert.doesNotMatch(outline, /chat-outline-title/)
  assert.doesNotMatch(shell, /header-outline-toggle/)
})
