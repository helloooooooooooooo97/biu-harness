import { test } from 'vitest'
import assert from 'node:assert/strict'
import type { SessionEvent } from '@biu/type-session'
import { computeTurnStats, type TurnStat } from './index.ts'

test('computeTurnStats aggregates step count, timing and usage per turn', () => {
  const events: SessionEvent[] = [
    { type: 'turn/start', turn: 1, seq: 1, ts: 1000 },
    { type: 'step/start', turn: 1, step: 0, seq: 2, ts: 1010 },
    { type: 'assistant/message', text: '', usage: { inputTokens: 100, outputTokens: 20 }, seq: 3, ts: 1020 },
    { type: 'step/end', turn: 1, step: 0, seq: 4, ts: 1030 },
    { type: 'step/start', turn: 1, step: 1, seq: 5, ts: 1040 },
    { type: 'assistant/message', text: '', usage: { inputTokens: 200, outputTokens: 40, cacheReadTokens: 50 }, seq: 6, ts: 1050 },
    { type: 'step/end', turn: 1, step: 1, seq: 7, ts: 1060 },
    { type: 'turn/end', turn: 1, reason: 'complete', seq: 8, ts: 1100 },
    // turn 2（进行中，无 turn/end）
    { type: 'turn/start', turn: 2, seq: 9, ts: 2000 },
    { type: 'step/start', turn: 2, step: 0, seq: 10, ts: 2010 },
    { type: 'assistant/message', text: '', usage: { inputTokens: 10, outputTokens: 5 }, seq: 11, ts: 2020 },
  ]

  const stats = computeTurnStats(events)
  const t1 = (stats as Record<string, TurnStat>)['1']
  const t2 = (stats as Record<string, TurnStat>)['2']

  // turn 1
  assert.equal(t1.turn, 1)
  assert.equal(t1.stepCount, 2)
  assert.equal(t1.startTs, 1000)
  assert.equal(t1.endTs, 1100)
  assert.equal(t1.durationMs, 100)
  assert.equal(t1.inputTokens, 300)
  assert.equal(t1.outputTokens, 60)
  assert.equal(t1.cacheReadTokens, 50)
  // 无显式 total 时 totalTokens = 各条 input+output 之和（cache 单独统计）
  assert.equal(t1.totalTokens, 100 + 20 + 200 + 40)

  // turn 2（无 turn/end，无 durationMs）
  assert.equal(t2.turn, 2)
  assert.equal(t2.stepCount, 1)
  assert.equal(t2.startTs, 2000)
  assert.equal(t2.durationMs, undefined)
  assert.equal(t2.endTs, undefined)
  assert.equal(t2.inputTokens, 10)
  assert.equal(t2.outputTokens, 5)
})

test('computeTurnStats with explicit totalTokens prefer it', () => {
  const events: SessionEvent[] = [
    { type: 'turn/start', turn: 1, seq: 1, ts: 1000 },
    {
      type: 'assistant/message',
      text: '',
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 999 },
      seq: 2,
      ts: 1020,
    },
  ]
  const stat = computeTurnStats(events, 1) as unknown as TurnStat
  assert.equal(stat.totalTokens, 999)
})
