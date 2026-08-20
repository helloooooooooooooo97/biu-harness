import { test } from 'vitest'
import assert from 'node:assert/strict'
import { projectNodes, type SessionEvent } from './session-project.ts'

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
