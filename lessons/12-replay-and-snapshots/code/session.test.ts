import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SessionLog } from './session.ts'

test('append 分配单调 seq，snapshot/replay 无损往返', () => {
  const log = new SessionLog()
  log.append('user/message', { role: 'user', content: '你好' })
  log.append('assistant/message', { message: { role: 'assistant', content: '你好！' } })
  const restored = SessionLog.replay(log.snapshot())
  assert.equal(JSON.stringify(restored), JSON.stringify(log.all))
  assert.equal(restored[0].seq, 1)
  assert.equal(restored[1].kind, 'assistant/message')
})
