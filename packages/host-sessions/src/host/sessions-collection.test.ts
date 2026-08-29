import { test } from 'vitest'
import assert from 'node:assert/strict'
import { sessionsCollection } from './sessions-collection.ts'

test('sessionsCollection maps summaries and writes title/pinned/tags', async () => {
  const calls: unknown[] = []
  const spec = sessionsCollection({
    listSummaries: async () => [
      {
        id: 's1',
        version: 1,
        eventCount: 3,
        title: 'hello',
        updatedAt: 100,
        type: 'chat',
        config: { pinned: false, tags: ['a'] },
      },
    ],
    rename: async (id, title) => {
      calls.push(['rename', id, title])
    },
    patchConfig: async (id, patch) => {
      calls.push(['patch', id, patch])
    },
  })
  assert.equal(spec.path, '/sessions')
  assert.equal(spec.view?.moduleId, 'sessions-db')
  const rows = await spec.list()
  assert.equal(rows[0]?.id, 's1')
  assert.equal(rows[0]?.title, 'hello')
  assert.deepEqual(rows[0]?.tags, ['a'])
  await spec.write?.('s1', { title: 'renamed', pinned: true, tags: ['b', 'c'] })
  assert.deepEqual(calls, [
    ['rename', 's1', 'renamed'],
    ['patch', 's1', { pinned: true, tags: ['b', 'c'] }],
  ])
})
