import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EchoTool, MemoryTools } from './index.ts'

// 本文件测 core-tools：① 注册/执行；② 未知工具；③ 重名保护。

test('注册并执行 echo 工具', async () => {
  const tools = new MemoryTools()
  tools.register(new EchoTool())
  assert.deepEqual(tools.list(), ['echo'])
  assert.equal(await tools.execute('echo', { text: 'hi' }), 'hi')
})

test('执行未知工具抛错', async () => {
  const tools = new MemoryTools()
  await assert.rejects(() => tools.execute('nope', {}), /未知工具: nope/)
})

test('重复注册同名工具抛错', () => {
  const tools = new MemoryTools()
  tools.register(new EchoTool())
  assert.throws(() => tools.register(new EchoTool()), /工具已存在: echo/)
})
