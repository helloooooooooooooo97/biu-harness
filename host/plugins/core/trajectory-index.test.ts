import { test } from 'vitest'
import assert from 'node:assert/strict'
import type { SessionEvent } from './session-types.ts'
import { buildTrajectoryWindow, findEvent, buildRequestMessages } from './trajectory-index.ts'

function ev(partial: Omit<SessionEvent, 'ts'> & { ts?: number }): SessionEvent {
  return { ts: partial.ts ?? partial.seq, ...partial } as SessionEvent
}

test('trajectory window returns summary rows without full bodies', () => {
  const raw: SessionEvent[] = [ev({ type: 'session/open', version: 1, seq: 0 })]
  for (let i = 0; i < 3; i++) {
    raw.push(ev({ type: 'user/message', text: `u${i}-${'x'.repeat(200)}`, seq: 10 + i * 2 }))
    raw.push(
      ev({
        type: 'assistant/message',
        text: `a${i}-${'y'.repeat(200)}`,
        seq: 11 + i * 2,
        usage: { inputTokens: 1, outputTokens: 2 },
      }),
    )
  }
  const window = buildTrajectoryWindow(raw, 2)
  assert.equal(window.hasMore, true)
  assert.ok(window.rows.every((row) => row.summary.length <= 160))
  assert.equal(window.rows.some((row) => row.type === 'assistant/message'), true)
})

test('findEvent and buildRequestMessages for assistant detail', () => {
  const raw: SessionEvent[] = [
    ev({ type: 'session/open', version: 1, seq: 0 }),
    ev({ type: 'system/prompt', text: 'sys', seq: 1 }),
    ev({ type: 'user/message', text: 'hi', seq: 2 }),
    ev({ type: 'assistant/message', text: 'yo', seq: 3, usage: { inputTokens: 1, outputTokens: 1 } }),
  ]
  const event = findEvent(raw, 3)
  assert.equal(event?.type, 'assistant/message')
  const messages = buildRequestMessages(raw, 3)
  assert.equal(messages[0]?.role, 'system')
  assert.equal(messages.some((item) => item.role === 'user' && item.content === 'hi'), true)
})
