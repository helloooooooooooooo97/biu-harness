import { test } from 'vitest'
import assert from 'node:assert/strict'
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
