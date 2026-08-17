import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MessageDeriver, SessionLog } from './index.ts'

// 本文件测 core-session：① durable 守卫；② 快照重放；③ derive。

test('durable 可写，live 事件被拒绝', () => {
  const log = new SessionLog()
  log.append('user/message', { role: 'user', content: 'hi' })
  assert.throws(() => log.append('agent/status', { status: 'running' }), /非 durable 事件/)
  assert.equal(log.length, 1)
})

test('快照与重放无损往返', () => {
  const log = new SessionLog()
  log.append('user/message', { role: 'user', content: '你好' })
  const restored = SessionLog.replay(log.snapshot())
  assert.equal(JSON.stringify(restored), JSON.stringify(log.all))
})

test('derive 从日志推导模型消息', () => {
  const log = new SessionLog()
  log.append('user/message', { role: 'user', content: 'hi' })
  log.append('assistant/message', {
    message: { role: 'assistant', content: [{ type: 'text', text: '你好！' }] },
  })
  const messages = new MessageDeriver().derive(log.all)
  assert.deepEqual(messages.map((m) => m.role), ['user', 'assistant'])
  assert.equal(messages[1].content, '你好！')
})
