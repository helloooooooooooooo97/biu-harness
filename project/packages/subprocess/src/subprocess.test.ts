import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SubprocessLocal, SubprocessRemoteMock } from './index.ts'

// 本文件测 subprocess 两个 Provider：本地 bash + 远程 canned。

test('SubprocessLocal 真实执行', async () => {
  assert.equal(await new SubprocessLocal().exec('echo hi'), 'hi')
})

test('SubprocessRemoteMock 返回 canned 输出', async () => {
  assert.equal(await new SubprocessRemoteMock('沙箱').exec('任意命令'), '沙箱')
})
