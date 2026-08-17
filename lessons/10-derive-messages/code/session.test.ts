import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SessionLog } from './session.ts'

test('append 分配单调递增的 seq 并记录时间', () => {
  const log = new SessionLog()
  const a = log.append('turn/start', { turn: 1 })
  const b = log.append('user/message', { role: 'user', content: 'hi' })
  assert.equal(a.seq, 1)
  assert.equal(b.seq, 2)
  assert.ok(a.time)
  assert.equal(log.length, 2)
})

test('all 返回只读事件流且顺序稳定', () => {
  const log = new SessionLog()
  log.append('user/message', { content: 'a' })
  log.append('user/message', { content: 'b' })
  assert.deepEqual(
    log.all.map((e) => e.data?.content),
    ['a', 'b'],
  )
})

test('append 返回的事件可以继续作为日志的一部分被推导', () => {
  const log = new SessionLog()
  const ev = log.append('user/message', { role: 'user', content: '你好' })
  assert.equal(ev.kind, 'user/message')
  assert.equal(log.all[0].seq, 1)
})
