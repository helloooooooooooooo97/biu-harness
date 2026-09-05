import { test } from 'vitest'
import assert from 'node:assert/strict'
import { agentNameLooksLikeId, resolveAgentName } from './person-cell.tsx'

test('agent display name comes from the sessions query, not the stored id', () => {
  const person = { kind: 'agent' as const, name: 'sess-age', sessionId: 'sess-agent-1' }
  assert.equal(agentNameLooksLikeId(person.name, person.sessionId), true)
  assert.equal(resolveAgentName(person, new Map()), '')
  assert.equal(resolveAgentName(person, new Map([['sess-agent-1', '蓝团爱']])), '蓝团爱')
  assert.equal(resolveAgentName({ kind: 'user', name: '用户' }, new Map()), '用户')
})
