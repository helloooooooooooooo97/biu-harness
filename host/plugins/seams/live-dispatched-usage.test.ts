import { test } from 'vitest'
import assert from 'node:assert/strict'
import { collectLiveDispatchedUsage, listLiveWakes } from './live-dispatched-usage.ts'
import type { SessionEvent } from '../core/session-types.ts'

function ev(partial: Omit<SessionEvent, 'seq' | 'ts'> & { seq?: number; ts?: number }): SessionEvent {
  return { seq: partial.seq ?? 0, ts: partial.ts ?? 1, ...partial } as SessionEvent
}

test('listLiveWakes reads session_wake/inject inside live turns', () => {
  const wakes = listLiveWakes([
    ev({ type: 'turn/start', turn: 2, ts: 10 }),
    ev({
      type: 'tool/call',
      id: '1',
      name: 'session_wake',
      arguments: '{"sessionId":"w1","text":"go"}',
      ts: 11,
    }),
    ev({ type: 'turn/end', turn: 2, reason: 'complete', ts: 12 }),
  ])
  assert.deepEqual(wakes, [{ ts: 11, targetId: 'w1', liveTurn: 2 }])
})

test('collectLiveDispatchedUsage attributes worker turn to live turn', () => {
  const liveId = 'live-1'
  const liveEvents = [
    ev({ type: 'turn/start', turn: 3, ts: 100 }),
    ev({
      type: 'tool/call',
      id: 'c1',
      name: 'session_wake',
      arguments: '{"sessionId":"worker-a","text":"run"}',
      ts: 110,
    }),
    ev({
      type: 'assistant/message',
      text: 'dispatched',
      usage: { inputTokens: 5, outputTokens: 2 },
      ts: 120,
    }),
    ev({ type: 'turn/end', turn: 3, reason: 'complete', ts: 130 }),
  ]
  const workerEvents = [
    ev({ type: 'turn/start', turn: 1, ts: 140 }),
    ev({
      type: 'user/message',
      text: 'run',
      kind: 'wake',
      sender: { type: 'session', sessionId: liveId },
      ts: 141,
    }),
    ev({
      type: 'assistant/message',
      text: 'done',
      usage: { inputTokens: 40, outputTokens: 10, cacheReadTokens: 4 },
      ts: 200,
    }),
    ev({ type: 'turn/end', turn: 1, reason: 'complete', ts: 210 }),
  ]

  const result = collectLiveDispatchedUsage(liveId, liveEvents, [
    { id: 'worker-a', events: workerEvents },
  ])
  assert.deepEqual(result.byLiveTurn['3'], {
    inputTokens: 40,
    outputTokens: 10,
    totalTokens: 50,
    cacheReadTokens: 4,
  })
  assert.equal(result.total.inputTokens, 40)
  assert.equal(result.total.outputTokens, 10)
})

test('collectLiveDispatchedUsage ignores turns not sent by this live', () => {
  const result = collectLiveDispatchedUsage(
    'live-1',
    [ev({ type: 'turn/start', turn: 1, ts: 1 }), ev({ type: 'turn/end', turn: 1, reason: 'complete', ts: 2 })],
    [
      {
        id: 'worker-a',
        events: [
          ev({ type: 'turn/start', turn: 1, ts: 3 }),
          ev({ type: 'user/message', text: 'hi', kind: 'wake', ts: 4 }),
          ev({
            type: 'assistant/message',
            text: 'yo',
            usage: { inputTokens: 9, outputTokens: 1 },
            ts: 5,
          }),
          ev({ type: 'turn/end', turn: 1, reason: 'complete', ts: 6 }),
        ],
      },
    ],
  )
  assert.deepEqual(result.byLiveTurn, {})
  assert.equal(result.total.inputTokens, 0)
})
