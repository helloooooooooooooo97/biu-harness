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

test('adding a pick while picking stays in pick mode so you can select again', () => {
  const ctx = new Context()
  const pick = new PickService(ctx)
  pick.enter()
  pick.add({ kind: 'page', id: 'p1', label: '页面', route: '/pages' })
  assert.equal(pick.picking, true)
  pick.add({ kind: 'page', id: 'p2', label: '另一页', route: '/pages' })
  assert.equal(pick.picking, true)
  assert.deepEqual(
    pick.refs.map((item) => item.id),
    ['p1', 'p2'],
  )
  pick.exit()
  assert.equal(pick.picking, false)
  assert.equal(pick.refs.length, 2)
})

test('adding a pick notifies the overlay to open', () => {
  const ctx = new Context()
  const pick = new PickService(ctx)
  let attached = 0
  const onAttached = () => {
    attached += 1
  }
  window.addEventListener('biu:pick-attached', onAttached)
  pick.add({ kind: 'page', id: 'p1', label: '页面', route: '/pages' })
  pick.add({ kind: 'page', id: 'p1', label: '页面', route: '/pages' })
  window.removeEventListener('biu:pick-attached', onAttached)
  assert.equal(attached, 1)
})

test('a new pick notifies once; the same pick does not notify again', () => {
  const ctx = new Context()
  const pick = new PickService(ctx)
  let attached = 0
  const onAttached = () => {
    attached += 1
  }
  window.addEventListener('biu:pick-attached', onAttached)
  pick.add({ kind: 'page', id: 'p1', label: '页面', route: '/pages' })
  pick.add({ kind: 'page', id: 'p2', label: '另一页', route: '/pages' })
  window.removeEventListener('biu:pick-attached', onAttached)
  assert.equal(attached, 2)
})

test('overlay-closed on window exits pick mode and keeps chips', () => {
  const ctx = new Context()
  const pick = new PickService(ctx)
  pick.enter()
  pick.add({ kind: 'page', id: 'p1', label: '页面', route: '/pages' })
  assert.equal(pick.picking, true)
  window.dispatchEvent(new Event('biu:overlay-closed'))
  assert.equal(pick.picking, false)
  assert.equal(pick.refs.length, 1)
})
