import { test } from 'vitest'
import assert from 'node:assert/strict'
import { findOpenTurnStep, healInterruptedTurnBodies } from './session-heal.ts'
import type { SessionEvent } from './session-types.ts'

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

test('healInterruptedTurnBodies closes step then turn', () => {
  const bodies = healInterruptedTurnBodies([
    ev({ type: 'turn/start', turn: 3, seq: 0 }),
    ev({ type: 'step/start', turn: 3, step: 1, seq: 1 }),
  ])
  assert.deepEqual(bodies, [
    { type: 'step/end', turn: 3, step: 1 },
    { type: 'turn/end', turn: 3, reason: 'host-restart' },
  ])
})

test('healInterruptedTurnBodies closes turn-only (cancelled mid-step path)', () => {
  const bodies = healInterruptedTurnBodies([
    ev({ type: 'turn/start', turn: 1, seq: 0 }),
    ev({ type: 'step/start', turn: 1, step: 0, seq: 1 }),
    // crash before step/end — still open step+turn
  ])
  assert.equal(bodies.length, 2)

  const turnOnly = healInterruptedTurnBodies([
    ev({ type: 'turn/start', turn: 4, seq: 0 }),
  ])
  assert.deepEqual(turnOnly, [{ type: 'turn/end', turn: 4, reason: 'host-restart' }])
})
