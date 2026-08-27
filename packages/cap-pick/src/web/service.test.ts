import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import { PickService } from './service.ts'

test('addMany dedupes kind+id and removeLast pops from the tail', () => {
  const ctx = new Context()
  const pick = new PickService(ctx)
  pick.addMany([
    { kind: 'task', id: 't1', label: '甲', route: '/tasks' },
    { kind: 'task', id: 't1', label: '甲', route: '/tasks' },
    { kind: 'session', id: 's1', label: '聊', route: '/' },
  ])
  assert.deepEqual(
    pick.refs.map((item) => item.id),
    ['t1', 's1'],
  )
  pick.removeLast()
  assert.deepEqual(
    pick.refs.map((item) => item.id),
    ['t1'],
  )
  pick.removeLast()
  assert.equal(pick.refs.length, 0)
  pick.removeLast()
  assert.equal(pick.refs.length, 0)
})
