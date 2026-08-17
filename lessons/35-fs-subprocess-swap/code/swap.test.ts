import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FsLocal } from './fs-local.ts'
import { FsRemoteMock } from './fs-remote-mock.ts'
import { SubprocessLocal } from './subprocess-local.ts'
import { SubprocessRemoteMock } from './subprocess-remote-mock.ts'
import { ToolExecutor } from './executor.ts'

// 本文件测"一起换 = 换执行世界"：同一个消费者类，本地 ↔ 远程行为随 Provider 切换。

test('ToolExecutor 本地执行世界', async () => {
  const executor = new ToolExecutor({ fs: new FsLocal(), sub: new SubprocessLocal() })
  await executor.write('/tmp/ex-swap.txt', '本地')
  assert.equal(await executor.read('/tmp/ex-swap.txt'), '本地')
  assert.equal(await executor.run('echo hi'), 'hi')
})

test('同一个 ToolExecutor 换成远程 mock，行为切换、代码不变', async () => {
  const executor = new ToolExecutor({ fs: new FsRemoteMock(), sub: new SubprocessRemoteMock('沙箱') })
  await executor.write('/remote/ex.txt', '远程')
  assert.equal(await executor.read('/remote/ex.txt'), '远程')
  assert.equal(await executor.run('任意命令'), '沙箱')
})
