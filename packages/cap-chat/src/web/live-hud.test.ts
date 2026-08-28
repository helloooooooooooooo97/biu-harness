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

test('clipHudText collapses whitespace and ellipsizes', () => {
  assert.equal(clipHudText('  a   b  '), 'a b')
  assert.equal(clipHudText('x'.repeat(90)).endsWith('…'), true)
})
