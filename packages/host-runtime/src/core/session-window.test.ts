import { test } from 'vitest'
import assert from 'node:assert/strict'
import type { SessionEvent, SessionEventBody } from './session-types.ts'
import { compactSessionEvents, sliceBeforeTurns, sliceTailTurns } from './session-window.ts'

function ev(partial: SessionEventBody & { seq: number; ts?: number }): SessionEvent {
  return { ...partial, ts: partial.ts ?? partial.seq }
}

test('compactSessionEvents drops chunks superseded by message', () => {
  const out = compactSessionEvents([
    ev({ type: 'user/message', text: 'hi', kind: 'wake', seq: 1 }),
    ev({ type: 'assistant/chunk', text: 'a', seq: 2 }),
    ev({ type: 'assistant/chunk', text: 'b', seq: 3 }),
    ev({ type: 'assistant/message', text: 'ab', seq: 4 }),
  ])
  assert.deepEqual(
    out.map((item) => item.type),
    ['user/message', 'assistant/message'],
  )
})

test('sliceTailTurns returns only last N user turns with preamble', () => {
  const raw: SessionEvent[] = [
    ev({ type: 'session/open', version: 1, seq: 0 }),
    ev({ type: 'system/prompt', text: 'sys', seq: 1 }),
  ]
  for (let turn = 0; turn < 5; turn++) {
    raw.push(ev({ type: 'user/message', text: `u${turn}`, kind: 'wake', seq: 10 + turn * 2 }))
    raw.push(ev({ type: 'assistant/message', text: `a${turn}`, seq: 11 + turn * 2 }))
  }
  const window = sliceTailTurns(raw, 2)
  assert.equal(window.hasMore, true)
  assert.equal(window.totalTurns, 5)
  assert.equal(window.events.some((item) => item.type === 'session/open'), true)
  assert.equal(window.events.some((item) => item.type === 'system/prompt'), true)
  const users = window.events.filter((item) => item.type === 'user/message')
  assert.deepEqual(
    users.map((item) => (item.type === 'user/message' ? item.text : '')),
    ['u3', 'u4'],
  )
})

test('sliceBeforeTurns pages older turns', () => {
  const raw: SessionEvent[] = [ev({ type: 'session/open', version: 1, seq: 0 })]
  for (let turn = 0; turn < 6; turn++) {
    raw.push(ev({ type: 'user/message', text: `u${turn}`, kind: 'wake', seq: 10 + turn * 2 }))
    raw.push(ev({ type: 'assistant/message', text: `a${turn}`, seq: 11 + turn * 2 }))
  }
  const tail = sliceTailTurns(raw, 2)
  const older = sliceBeforeTurns(raw, tail.events.find((item) => item.type === 'user/message')!.seq, 2)
  const users = older.events.filter((item) => item.type === 'user/message')
  assert.deepEqual(
    users.map((item) => (item.type === 'user/message' ? item.text : '')),
    ['u2', 'u3'],
  )
  assert.equal(older.hasMore, true)
})
