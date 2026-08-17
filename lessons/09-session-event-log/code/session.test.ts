import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SessionLog } from './session.ts'

test('append 分配单调递增 seq 并记录 time', () => {
  const log = new SessionLog()
  const a = log.append('turn/start', { turn: 1 })
  const b = log.append('user/message', { role: 'user', content: 'hi' })
  assert.equal(a.seq, 1)
  assert.equal(b.seq, 2)
  assert.ok(a.time)
  assert.equal(log.length, 2)
})

test('非 JSON 数据被拒绝', () => {
  const log = new SessionLog()
  assert.throws(() => log.append('user/message', { cb: () => {} }), /必须可 JSON 序列化/)
  assert.throws(() => log.append('user/message', { when: new Date() }), /必须可 JSON 序列化/)
  assert.equal(log.length, 0)
})

test('返回的事件是冻结的，修改抛 TypeError', () => {
  const log = new SessionLog()
  const ev = log.append('user/message', { content: 'hi' })
  assert.equal(Object.isFrozen(ev), true)
  assert.equal(Object.isFrozen(ev.data), true)
  assert.throws(() => {
    (ev as { seq: number }).seq = 99
  }, TypeError)
})

test('快照与重放保持一致', () => {
  const log = new SessionLog()
  log.append('user/message', { role: 'user', content: '你好' })
  log.append('assistant/message', { message: { role: 'assistant', content: '你好！' } })
  const snapshot = log.snapshot()
  const restored = SessionLog.replay(snapshot)
  assert.equal(JSON.stringify(restored), JSON.stringify(log.all))
  assert.equal(restored[0].seq, 1)
  assert.equal(restored[1].kind, 'assistant/message')
})

test('all 返回稳定只读视图', () => {
  const log = new SessionLog()
  log.append('turn/start', { turn: 1 })
  const view = log.all
  log.append('turn/end', { turn: 1, reason: 'completed' })
  assert.equal(view.length, 2, '视图与日志共享同一底层数组')
  assert.deepEqual(
    view.map((e) => e.kind),
    ['turn/start', 'turn/end'],
  )
})
