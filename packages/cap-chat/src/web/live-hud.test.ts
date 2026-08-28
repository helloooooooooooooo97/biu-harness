import { test } from 'vitest'
import assert from 'node:assert/strict'
import { clipHudText, extractLiveHud } from './live-hud.ts'
import type { ChatNode } from '@biu/web-session-view'

test('extractLiveHud reads turn, tools and last assistant text', () => {
  const nodes: ChatNode[] = [
    { id: 'u1', kind: 'user', text: 'hi' },
    {
      id: 'r1',
      kind: 'reply',
      copyText: 'done',
      turn: 3,
      streaming: false,
      steps: [{ step: 1, inputTokens: 1, outputTokens: 1, toolCount: 1, messageChars: 4 }],
      parts: [
        { id: 't1', kind: 'tool', callId: 'c1', name: 'bash', arguments: '{}' },
        { id: 'a1', kind: 'assistant', text: '  最终结果  ' },
      ],
    },
  ]
  const hud = extractLiveHud(nodes, 9)
  assert.equal(hud.turn, 3)
  assert.equal(hud.step, 1)
  assert.equal(hud.toolIndex, 1)
  assert.equal(hud.lastTool?.name, 'bash')
  assert.equal(hud.lastOutput, '最终结果')
})

test('extractLiveHud can read a selected older reply', () => {
  const nodes: ChatNode[] = [
    { id: 'u1', kind: 'user', text: 'a' },
    {
      id: 'r1',
      kind: 'reply',
      copyText: 'one',
      turn: 1,
      streaming: false,
      parts: [{ id: 'a1', kind: 'assistant', text: 'first' }],
    },
    { id: 'u2', kind: 'user', text: 'b' },
    {
      id: 'r2',
      kind: 'reply',
      copyText: 'two',
      turn: 2,
      streaming: false,
      parts: [{ id: 'a2', kind: 'assistant', text: 'second' }],
    },
  ]
  const older = extractLiveHud(nodes, 0, 'r1')
  assert.equal(older.turn, 1)
  assert.equal(older.lastOutput, 'first')
  assert.equal(older.replyIndex, 0)
  assert.equal(older.replyCount, 2)
})

test('clipHudText collapses whitespace and ellipsizes', () => {
  assert.equal(clipHudText('  a   b  '), 'a b')
  assert.equal(clipHudText('x'.repeat(90)).endsWith('…'), true)
})
