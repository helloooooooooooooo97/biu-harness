import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SessionLog } from './session.ts'

// 本文件测 SessionLog（append-only 事件流）：
//   ① seq/time；② 数据校验；③ 冻结；④ 快照重放；⑤ 只读视图。

test('append 分配单调递增 seq 并记录 time', () => {
  // 验证每次 append 的 seq 单调递增且带时间戳——日志顺序性的基础。
  const log = new SessionLog()
  const a = log.append('turn/start', { turn: 1 })
  const b = log.append('user/message', { role: 'user', content: 'hi' })
  assert.equal(a.seq, 1)
  assert.equal(b.seq, 2)
  assert.ok(a.time)
  assert.equal(log.length, 2)
})

test('非 JSON 数据被拒绝', () => {
  // 验证硬约束：函数/Date 等无法落盘的数据 append 时抛错，且日志长度不变（没有半写入）。
  const log = new SessionLog()
  assert.throws(() => log.append('user/message', { cb: () => {} }), /必须可 JSON 序列化/)
  assert.throws(() => log.append('user/message', { when: new Date() }), /必须可 JSON 序列化/)
  assert.equal(log.length, 0)
})

test('返回的事件是冻结的，修改抛 TypeError', () => {
  // 验证不可篡改：append 返回的事件及其 data 都被冻结，赋值会抛 TypeError。
  const log = new SessionLog()
  const ev = log.append('user/message', { content: 'hi' })
  assert.equal(Object.isFrozen(ev), true)
  assert.equal(Object.isFrozen(ev.data), true)
  assert.throws(() => {
    (ev as { seq: number }).seq = 99
  }, TypeError)
})

test('快照与重放保持一致', () => {
  // 验证无损往返：snapshot() → replay() 后逐字节一致，顺序与内容都不丢。
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
  // 验证 all 是同一个底层数组的引用（活的视图）：追加后视图自动变长，能看到最新日志。
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
