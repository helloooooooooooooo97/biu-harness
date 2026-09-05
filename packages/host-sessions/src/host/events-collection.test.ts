import { test } from 'vitest'
import assert from 'node:assert/strict'
import { eventsCollection, eventRecordId } from './events-collection.ts'

test('eventsCollection is a read-only table over session logs', async () => {
  const spec = eventsCollection({
    listSummaries: async () => [{ id: 's1' }],
    require: async (id) => ({
      id,
      events: [
        { type: 'session/open', version: 1, seq: 0, ts: 10 },
        { type: 'user/message', text: 'hi', kind: 'wake', seq: 1, ts: 20 },
      ],
    }),
  })
  assert.equal(spec.path, '/events')
  assert.equal(spec.view?.moduleId, 'events-db')
  assert.deepEqual(spec.records, { update: false, create: false, delete: false })
  assert.match(String(spec.view?.blurb), /会话时间线/)
  assert.doesNotMatch(String(spec.view?.blurb), /dispatch/)
  const rows = await spec.list()
  assert.equal(rows.some((row) => row.id === eventRecordId('s1', 1)), true)
  const hit = rows.find((row) => row.seq === 1)
  assert.equal(hit?.sessionId, 's1')
  assert.equal(hit?.type, 'user/message')
  const one = await spec.get(eventRecordId('s1', 1))
  assert.equal(one?.type, 'user/message')
  const filtered = await spec.list({ filter: { sessionId: 'missing' } })
  assert.equal(filtered.length, 0)
})
