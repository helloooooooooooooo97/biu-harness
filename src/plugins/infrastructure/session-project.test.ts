import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  formatTrajectoryUsage,
  projectNodes,
  projectTrajectory,
  sumTrajectoryUsage,
  type SessionEvent,
} from './session-project.ts'

test('projects user, streaming assistant, tool call/result from session events', () => {
  const events: SessionEvent[] = [
    { type: 'session/open', version: 1, seq: 0, ts: 1 },
    { type: 'user/message', text: 'hi', kind: 'wake', seq: 1, ts: 2 },
    { type: 'assistant/chunk', text: 'hel', seq: 2, ts: 3 },
    { type: 'assistant/chunk', text: 'lo', seq: 3, ts: 4 },
    { type: 'assistant/message', text: 'hello', seq: 4, ts: 5 },
    { type: 'tool/call', id: 'c1', name: 'bash', arguments: '{"command":"echo"}', seq: 5, ts: 6 },
    { type: 'tool/result', id: 'c1', name: 'bash', ok: true, detail: 'ok', seq: 6, ts: 7 },
    { type: 'assistant/message', text: 'done', seq: 7, ts: 8 },
  ]
  const nodes = projectNodes(events)
  assert.deepEqual(
    nodes.map((node) => node.kind),
    ['user', 'assistant', 'tool', 'assistant'],
  )
  assert.equal(nodes[1]?.kind === 'assistant' && nodes[1].text, 'hello')
  assert.equal(nodes[2]?.kind === 'tool' && nodes[2].result?.detail, 'ok')
})

test('turn/end non-complete becomes a status row', () => {
  const nodes = projectNodes([
    { type: 'turn/start', turn: 1, seq: 0, ts: 1 },
    { type: 'turn/end', turn: 1, reason: 'cancelled', seq: 1, ts: 2 },
  ])
  assert.equal(nodes[0]?.kind, 'turn')
  assert.match(nodes[0]?.kind === 'turn' ? nodes[0].text : '', /cancelled/)
})

test('projectTrajectory keeps seq ledger and tool callIds for inspect', () => {
  const events: SessionEvent[] = [
    { type: 'session/open', version: 1, seq: 0, ts: 1 },
    { type: 'turn/start', turn: 1, seq: 1, ts: 2 },
    { type: 'user/message', text: 'run bash', seq: 2, ts: 3 },
    { type: 'tool/call', id: 'c1', name: 'bash', arguments: '{"command":"ls"}', seq: 3, ts: 4 },
    { type: 'tool/result', id: 'c1', name: 'bash', ok: true, detail: 'ok', seq: 4, ts: 5 },
    { type: 'turn/end', turn: 1, reason: 'complete', seq: 5, ts: 6 },
  ]
  const rows = projectTrajectory(events)
  assert.equal(rows.some((row) => row.type === 'session/open'), false)
  const call = rows.find((row) => row.type === 'tool/call')
  assert.equal(call?.callId, 'c1')
  assert.equal(call?.turn, 1)
  assert.match(call?.summary ?? '', /bash/)
})

test('projectTrajectory indents step boundaries and in-step events', () => {
  const rows = projectTrajectory([
    { type: 'turn/start', turn: 1, seq: 1, ts: 1 },
    { type: 'user/message', text: 'hi', seq: 2, ts: 2 },
    { type: 'step/start', turn: 1, step: 0, seq: 3, ts: 3 },
    { type: 'assistant/message', text: 'ok', seq: 4, ts: 4 },
    { type: 'tool/call', id: 't1', name: 'bash', arguments: '{}', seq: 5, ts: 5 },
    { type: 'step/end', turn: 1, step: 0, seq: 6, ts: 6 },
    { type: 'turn/end', turn: 1, reason: 'complete', seq: 7, ts: 7 },
  ])
  const byType = Object.fromEntries(rows.map((row) => [row.type, row]))
  assert.equal(byType['turn/start']?.depth, 0)
  assert.equal(byType['user/message']?.depth, 0)
  assert.equal(byType['step/start']?.depth, 1)
  assert.equal(byType['assistant/message']?.depth, 2)
  assert.equal(byType['tool/call']?.depth, 2)
  assert.equal(byType['step/end']?.depth, 1)
  assert.equal(byType['turn/end']?.depth, 0)
})

test('assistant/message with empty text still has a visible tool_calls summary and usage', () => {
  const events: SessionEvent[] = [
    {
      type: 'assistant/message',
      text: '',
      tool_calls: [{ id: '1', name: 'clock_now', arguments: '{}' }],
      usage: { inputTokens: 11, outputTokens: 3 },
      seq: 1,
      ts: 1,
    },
    {
      type: 'assistant/message',
      text: '现在是下午',
      usage: { inputTokens: 20, outputTokens: 8, cacheReadTokens: 4 },
      seq: 2,
      ts: 2,
    },
  ]
  const rows = projectTrajectory(events)
  assert.match(rows[0]?.summary ?? '', /tool call/)
  assert.match(rows[0]?.summary ?? '', /clock_now/)
  assert.deepEqual(rows[0]?.usage, { inputTokens: 11, outputTokens: 3 })
  assert.equal(rows[1]?.summary, '现在是下午')
  assert.equal(formatTrajectoryUsage(rows[1]?.usage), '20→8 c4')
  assert.deepEqual(sumTrajectoryUsage(events), {
    inputTokens: 31,
    outputTokens: 11,
    totalTokens: 42,
    cacheReadTokens: 4,
  })
})
