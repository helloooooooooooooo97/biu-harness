import { test } from 'vitest'
import assert from 'node:assert/strict'
import { bootLoadCollections, collectionNavKey } from './nav-boot.ts'
import type { CollectionInfo } from '@biu/type-file-system'

function row(id: string): CollectionInfo {
  return { id, path: `/${id}`, kind: 'collection', label: id, view: { moduleId: id, route: `/${id}` } }
}

test('collectionNavKey ignores tables without a nav view', () => {
  assert.equal(collectionNavKey([row('b'), row('a'), { id: 'hidden', path: '/hidden', kind: 'collection', label: 'x', view: null }]), 'a,b')
})

test('bootLoadCollections retries empty/failed loads until the nav set is stable', async () => {
  const calls: string[] = []
  const waits: number[] = []
  const load = async () => {
    calls.push('load')
    if (calls.length === 1) throw new Error('host down')
    if (calls.length === 2) return []
    if (calls.length === 3) return [row('plugins')]
    return [row('plugins'), row('page')]
  }
  const updates: string[] = []
  const listed = await bootLoadCollections(load, {
    attempts: 8,
    delayMs: 5,
    wait: async (ms) => {
      waits.push(ms)
    },
    onUpdate: (rows) => updates.push(rows.map((item) => item.id).join(',')),
  })
  assert.ok(updates.includes('plugins,page'))
  assert.deepEqual(
    listed.map((item) => item.id),
    ['plugins', 'page'],
  )
  assert.ok(calls.length >= 5)
  assert.ok(waits.length >= 1)
})
