import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  collectLiveDispatchedTasks,
  collectLiveDispatchedUsage,
  listLiveWakes,
} from './live-dispatched-usage.ts'
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
  assert.equal(wakes.length, 1)
  assert.equal(wakes[0]?.targetId, 'w1')
  assert.equal(wakes[0]?.liveTurn, 2)
  assert.equal(wakes[0]?.tool, 'session_wake')
  assert.equal(wakes[0]?.preview, 'go')
})

test('collectLiveDispatchedTasks includes status and usage per wake', () => {
  const liveId = 'live-1'
  const liveEvents = [
    ev({ type: 'turn/start', turn: 3, ts: 100 }),
    ev({
      type: 'tool/call',
      id: 'c1',
      name: 'session_wake',
      arguments: '{"sessionId":"worker-a","text":"run tests"}',
      ts: 110,
    }),
    ev({ type: 'turn/end', turn: 3, reason: 'complete', ts: 130 }),
  ]
  const workerEvents = [
    ev({ type: 'turn/start', turn: 1, ts: 140 }),
    ev({
      type: 'user/message',
      text: 'run tests',
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

  const result = collectLiveDispatchedTasks(liveId, liveEvents, [
    { id: 'worker-a', events: workerEvents },
  ])
  assert.equal(result.tasks.length, 1)
  assert.equal(result.tasks[0]?.status, 'complete')
  assert.equal(result.tasks[0]?.workerTurn, 1)
  assert.equal(result.tasks[0]?.preview, 'run tests')
  assert.deepEqual(result.tasks[0]?.usage, {
    inputTokens: 40,
    outputTokens: 10,
    totalTokens: 50,
    cacheReadTokens: 4,
  })
  assert.equal(result.byLiveTurn['3']?.tasks.length, 1)
  assert.equal(result.byLiveTurn['3']?.usage.inputTokens, 40)
})

test('collectLiveDispatchedTasks marks unmatched wake as pending', () => {
  const result = collectLiveDispatchedTasks(
    'live-1',
    [
      ev({ type: 'turn/start', turn: 1, ts: 1 }),
      ev({
        type: 'tool/call',
        id: 'c1',
        name: 'session_wake',
        arguments: '{"sessionId":"worker-a","text":"x"}',
        ts: 2,
      }),
      ev({ type: 'turn/end', turn: 1, reason: 'complete', ts: 3 }),
    ],
    [{ id: 'worker-a', events: [] }],
  )
  assert.equal(result.tasks[0]?.status, 'pending')
})

test('collectLiveDispatchedUsage still aggregates by live turn', () => {
  const liveId = 'live-1'
  const result = collectLiveDispatchedUsage(
    liveId,
    [
      ev({ type: 'turn/start', turn: 3, ts: 100 }),
      ev({
        type: 'tool/call',
        id: 'c1',
        name: 'session_wake',
        arguments: '{"sessionId":"worker-a","text":"run"}',
        ts: 110,
      }),
      ev({ type: 'turn/end', turn: 3, reason: 'complete', ts: 130 }),
    ],
    [
      {
        id: 'worker-a',
        events: [
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
            usage: { inputTokens: 40, outputTokens: 10 },
            ts: 200,
          }),
          ev({ type: 'turn/end', turn: 1, reason: 'complete', ts: 210 }),
        ],
      },
    ],
  )
  assert.deepEqual(result.byLiveTurn['3'], {
    inputTokens: 40,
    outputTokens: 10,
    totalTokens: 50,
  })
})
