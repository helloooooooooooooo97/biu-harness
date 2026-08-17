import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SessionLog } from './session.ts'

// 本文件测日志守卫：① durable 可写；② live 被拒绝且不产生半写入。

test('durable 事件可以 append', () => {
  // 验证正常路径：tool/result 等事实事件写入日志，seq 递增。
  const log = new SessionLog()
  log.append('user/message', { content: 'hi' })
  log.append('tool/result', { callId: 'c1', message: { role: 'tool', content: 'ok' } })
  assert.equal(log.length, 2)
  assert.equal(log.all[0].seq, 1)
})

test('live 事件 append 抛错且日志长度不变', () => {
  // 验证守卫：agent/pre-step 是 live，写日志必须抛错，不能留下半条记录。
  const log = new SessionLog()
  assert.throws(() => log.append('agent/pre-step', { messages: [] }), /live 事件不能写进会话日志/)
  assert.equal(log.length, 0)
})

test('未知事件也被拒绝', () => {
  // 验证安全默认：未登记事件一律拒绝，日志只收 durable。
  const log = new SessionLog()
  assert.throws(() => log.append('future/custom', {}), /live 事件不能写进会话日志/)
})
