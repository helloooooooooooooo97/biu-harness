import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SessionLog } from './session.ts'

// 本文件测 SessionLog 的快照/重放往返：snapshot() → replay() 必须逐字节一致。

test('append 分配单调 seq，snapshot/replay 无损往返', () => {
  // 验证日志落盘/恢复无损：重放结果与原日志 JSON 一致，seq 与事件类型都保留。
  const log = new SessionLog()
  log.append('user/message', { role: 'user', content: '你好' })
  log.append('assistant/message', { message: { role: 'assistant', content: '你好！' } })
  const restored = SessionLog.replay(log.snapshot())
  assert.equal(JSON.stringify(restored), JSON.stringify(log.all))
  assert.equal(restored[0].seq, 1)
  assert.equal(restored[1].kind, 'assistant/message')
})
