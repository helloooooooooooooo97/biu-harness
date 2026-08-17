import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ToolRegistry } from './tool-registry.ts'
import { EchoTool, type Tool } from './tool.ts'

// 本文件测 ToolRegistry（工具注册表）：
//   ① 注册/查询/列表；② 重复注册；③ 未知工具；④ 正常执行；⑤ 自定义工具可插拔。

test('register / get / list 正常工作', () => {
  // 验证注册后 get 能取回同一实例，list 列出全部工具名。
  const registry = new ToolRegistry()
  const tool = new EchoTool()
  registry.register(tool)
  assert.equal(registry.get('echo'), tool)
  assert.deepEqual(registry.list().map((t) => t.name), ['echo'])
})

test('重复注册同名工具抛错', () => {
  // 验证重名保护：同名工具不能注册两次（否则模型会分不清调哪个）。
  const registry = new ToolRegistry()
  registry.register(new EchoTool())
  assert.throws(() => registry.register(new EchoTool()), /工具已存在: echo/)
})

test('执行未知工具抛错', async () => {
  // 验证未注册的工具执行时抛"未知工具"——这是 AgentV2 兜底成错误文本的底层保障。
  const registry = new ToolRegistry()
  await assert.rejects(() => registry.execute('nope', {}), /未知工具: nope/)
})

test('执行已注册工具返回结果', async () => {
  // 验证 execute() 走工具的真实实现并返回结果。
  const registry = new ToolRegistry()
  registry.register(new EchoTool())
  assert.equal(await registry.execute('echo', { text: 'hi' }), 'hi')
})

test('自定义工具可注册并执行', async () => {
  // 验证注册表不绑死内置实现：任意符合 Tool 接口的对象都能挂进来执行。
  const custom: Tool = {
    name: 'double',
    description: '数字翻倍',
    parameters: { n: { type: 'number', required: true } },
    async execute(args) {
      return String(Number(args.n) * 2)
    },
  }
  const registry = new ToolRegistry()
  registry.register(custom)
  assert.equal(await registry.execute('double', { n: 21 }), '42')
})
