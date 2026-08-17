import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineTool, ToolRegistry } from './define-tool.ts'

// 本文件测 core-tools 的 schema 工具：校验与渲染。

const sumTool = defineTool({
  name: 'sum_numbers',
  description: '对数字数组求和',
  parameters: { type: 'object', properties: { numbers: { type: 'array', required: true } } },
  output: { schema: { type: 'number' }, render: (_a, v) => `总和为 ${String(v)}` },
  async execute(args) {
    return (args.numbers as number[]).reduce((a, b) => a + b, 0)
  },
})

test('schema 校验拒绝缺参与类型错误', async () => {
  const registry = new ToolRegistry()
  registry.register(sumTool)
  await assert.rejects(() => registry.execute('sum_numbers', {}), /缺少必填参数/)
  await assert.rejects(() => registry.execute('sum_numbers', { numbers: 'x' }), /类型应为 array/)
})

test('正常执行并渲染', async () => {
  const registry = new ToolRegistry()
  registry.register(sumTool)
  const result = await registry.execute('sum_numbers', { numbers: [1, 2, 3] })
  assert.equal(result.value, 6)
  assert.equal(result.text, '总和为 6')
})
