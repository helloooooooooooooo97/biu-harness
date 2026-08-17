import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SubprocessLocal } from './subprocess-local.ts'
import { SubprocessRemoteMock } from './subprocess-remote-mock.ts'

// 本文件测 subprocess 两个 Provider：本地 bash + 远程 canned。

test('SubprocessLocal 真实执行', async () => {
  const sub = new SubprocessLocal()
  assert.equal(await sub.exec('echo hi'), 'hi')
})

test('SubprocessRemoteMock 返回 canned 输出', async () => {
  const sub = new SubprocessRemoteMock('沙箱输出')
  assert.equal(await sub.exec('rm -rf /'), '沙箱输出')
})
