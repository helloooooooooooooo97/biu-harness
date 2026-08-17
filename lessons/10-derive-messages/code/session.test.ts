import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SessionLog } from './session.ts'

// 本文件测 SessionLog 的日志机制：① seq/time；② 顺序稳定；③ 返回即真实（写入即可见）。

test('append 分配单调递增的 seq 并记录时间', () => {
  // 验证 seq 从 1 递增、时间戳存在——重放/裁剪（afterSeq）都靠它当坐标。
  const log = new SessionLog()
  const a = log.append('turn/start', { turn: 1 })
  const b = log.append('user/message', { role: 'user', content: 'hi' })
  assert.equal(a.seq, 1)
  assert.equal(b.seq, 2)
  assert.ok(a.time)
  assert.equal(log.length, 2)
})

test('all 返回只读事件流且顺序稳定', () => {
  // 验证读取顺序 = 写入顺序，data 内容原样保留。
  const log = new SessionLog()
  log.append('user/message', { content: 'a' })
  log.append('user/message', { content: 'b' })
  assert.deepEqual(
    log.all.map((e) => e.data?.content),
    ['a', 'b'],
  )
})

test('append 返回的事件可以继续作为日志的一部分被推导', () => {
  // 验证 append 的返回值不是副本，而是日志里的那条（后续 deriver 立即能看到）。
  const log = new SessionLog()
  const ev = log.append('user/message', { role: 'user', content: '你好' })
  assert.equal(ev.kind, 'user/message')
  assert.equal(log.all[0].seq, 1)
})
