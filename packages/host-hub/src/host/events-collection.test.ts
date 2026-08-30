import { test } from 'vitest'
import assert from 'node:assert/strict'
import { eventsCollection } from './events-collection.ts'

test('eventsCollection is a read-only File System table over hub buffer', () => {
  const spec = eventsCollection({
    listEvents: () => [
      { id: 'evt-1', ts: 42, mode: 'emit', name: 'session/event', args: [{ ok: true }] },
    ],
  })
  assert.equal(spec.path, '/events')
  assert.equal(spec.view?.moduleId, 'events-db')
  assert.equal(spec.write, undefined)
  assert.deepEqual(spec.records, { create: false, delete: false })
  const rows = spec.list()
  assert.ok(Array.isArray(rows))
  const listed = rows as Array<{ id: string; title: string; args: string }>
  assert.equal(listed[0]?.id, 'evt-1')
  assert.equal(listed[0]?.title, 'session/event')
  assert.equal(listed[0]?.args, '[{"ok":true}]')
})
