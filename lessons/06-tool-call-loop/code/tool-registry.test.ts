import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ToolRegistry } from './tool-registry.ts'
import { EchoTool, type Tool } from './tool.ts'

test('register / get / list 正常工作', () => {
  const registry = new ToolRegistry()
  const tool = new EchoTool()
  registry.register(tool)
  assert.equal(registry.get('echo'), tool)
  assert.deepEqual(registry.list().map((t) => t.name), ['echo'])
})

test('重复注册同名工具抛错', () => {
  const registry = new ToolRegistry()
  registry.register(new EchoTool())
  assert.throws(() => registry.register(new EchoTool()), /工具已存在: echo/)
})

test('执行未知工具抛错', async () => {
  const registry = new ToolRegistry()
  await assert.rejects(() => registry.execute('nope', {}), /未知工具: nope/)
})

test('执行已注册工具返回结果', async () => {
  const registry = new ToolRegistry()
  registry.register(new EchoTool())
  assert.equal(await registry.execute('echo', { text: 'hi' }), 'hi')
})

test('自定义工具可注册并执行', async () => {
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
