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
        mascot: { shape: 'pebble', color: 'orange', eye: 1 },
        config: { pinned: false, tags: ['a'] },
      },
    ],
    rename: async (id, title) => {
      calls.push(['rename', id, title])
    },
    patchConfig: async (id, patch) => {
      calls.push(['patch', id, patch])
    },
    delete: async (id) => {
      calls.push(['delete', id])
      return true
    },
  })
  assert.equal(spec.path, '/sessions')
  assert.equal(spec.view?.moduleId, 'sessions-db')
  assert.deepEqual(spec.records, { update: true, create: false, delete: true })
  const rows = await spec.list()
  assert.equal(rows[0]?.id, 's1')
  assert.equal(rows[0]?.title, 'hello')
  assert.deepEqual(rows[0]?.mascot, { shape: 'pebble', color: 'orange', eye: 1 })
  assert.equal(rows[0]?.mascotShape, 'pebble')
  assert.equal(rows[0]?.mascotColor, 'orange')
  assert.equal(rows[0]?.mascotEye, 1)
  assert.equal(rows[0]?.mascotName, '橙石美')
  assert.deepEqual(rows[0]?.tags, ['a'])
  await spec.update?.('s1', { title: 'renamed', pinned: true, tags: ['b', 'c'] })
  await spec.remove?.({ ids: ['s1'] })
  assert.deepEqual(calls, [
    ['rename', 's1', 'renamed'],
    ['patch', 's1', { pinned: true, tags: ['b', 'c'] }],
    ['delete', 's1'],
  ])
  assert.equal(spec.actions?.some((item) => item.id === 'progress'), true)
  assert.equal(spec.actions?.some((item) => item.id === 'compact'), true)
  assert.equal(spec.actions?.some((item) => item.id === 'star'), true)
  const starred = await spec.actions?.find((item) => item.id === 'star')?.run('s1', rows[0]!, { pinned: true })
  assert.deepEqual(starred, { id: 's1', pinned: true })
})
