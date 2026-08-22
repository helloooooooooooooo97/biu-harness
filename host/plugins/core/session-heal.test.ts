import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  findOpenTurnStep,
  findOrphanToolCalls,
  healInterruptedTurnBodies,
} from './session-heal.ts'
import type { SessionEvent } from './session-types.ts'
import { deriveMessages } from './sessions.ts'

function ev(partial: Omit<SessionEvent, 'seq' | 'ts'> & { seq?: number; ts?: number }): SessionEvent {
  return { seq: partial.seq ?? 0, ts: partial.ts ?? 1, ...partial } as SessionEvent
}

test('findOpenTurnStep detects unfinished turn and step', () => {
  const open = findOpenTurnStep([
    ev({ type: 'session/open', version: 1, seq: 0 }),
    ev({ type: 'turn/start', turn: 2, seq: 1 }),
    ev({ type: 'step/start', turn: 2, step: 0, seq: 2 }),
  ])
  assert.deepEqual(open, { openTurn: 2, openStep: { turn: 2, step: 0 } })

  const closed = findOpenTurnStep([
    ev({ type: 'turn/start', turn: 1, seq: 0 }),
    ev({ type: 'step/start', turn: 1, step: 0, seq: 1 }),
    ev({ type: 'step/end', turn: 1, step: 0, seq: 2 }),
    ev({ type: 'turn/end', turn: 1, reason: 'complete', seq: 3 }),
  ])
  assert.deepEqual(closed, { openTurn: null, openStep: null })
})

test('healInterruptedTurnBodies fills orphan tool results then closes step/turn', () => {
  const bodies = healInterruptedTurnBodies([
    ev({ type: 'turn/start', turn: 3, seq: 0 }),
    ev({ type: 'step/start', turn: 3, step: 1, seq: 1 }),
    ev({
      type: 'assistant/message',
      text: '',
      tool_calls: [{ id: 'c1', name: 'session_wake', arguments: '{}' }],
      seq: 2,
    }),
  ])
  assert.deepEqual(bodies, [
    {
      type: 'tool/result',
      id: 'c1',
      name: 'session_wake',
      ok: false,
      detail:
        'interrupted: tool call was not completed (host restart or crash before tool/result)',
    },
    { type: 'step/end', turn: 3, step: 1 },
    { type: 'turn/end', turn: 3, reason: 'host-restart' },
  ])
})

test('findOrphanToolCalls ignores completed tool pairs', () => {
  assert.deepEqual(
    findOrphanToolCalls([
      ev({
        type: 'assistant/message',
        text: '',
        tool_calls: [{ id: 'c1', name: 'bash', arguments: '{}' }],
        seq: 0,
      }),
      ev({ type: 'tool/result', id: 'c1', name: 'bash', ok: true, detail: 'ok', seq: 1 }),
    ]),
    [],
  )
})

test('healInterruptedTurnBodies closes turn-only', () => {
  const turnOnly = healInterruptedTurnBodies([ev({ type: 'turn/start', turn: 4, seq: 0 })])
  assert.deepEqual(turnOnly, [{ type: 'turn/end', turn: 4, reason: 'host-restart' }])
})

test('deriveMessages synthesizes missing tool results before next user', () => {
  const messages = deriveMessages([
    ev({ type: 'user/message', text: 'first', kind: 'wake', seq: 0 }),
    ev({
      type: 'assistant/message',
      text: '',
      tool_calls: [{ id: 't1', name: 'session_list', arguments: '{}' }],
      seq: 1,
    }),
    // crash: no tool/result
    ev({ type: 'user/message', text: 'hello again', kind: 'wake', seq: 2 }),
  ])
  assert.equal(messages[0]?.role, 'user')
  assert.equal(messages[1]?.role, 'assistant')
  assert.equal(messages[1]?.tool_calls?.[0]?.id, 't1')
  assert.equal(messages[2]?.role, 'tool')
  assert.equal(messages[2]?.tool_call_id, 't1')
  assert.equal(messages[3]?.role, 'user')
  assert.equal(messages[3]?.content, 'hello again')
})
