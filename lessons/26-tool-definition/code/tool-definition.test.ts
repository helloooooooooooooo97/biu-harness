import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineTool, ToolRegistry } from './tool-definition.ts'

// 本文件测 defineTool：① 必填校验；② 参数校验；③ 渲染；④ listSchemas。

const sumTool = defineTool({
  name: 'sum_numbers',
  description: '对数字数组求和',
  parameters: {
    type: 'object',
    properties: {
      numbers: { type: 'array', required: true, description: '数字列表' },
    },
  },
  output: {
    schema: { type: 'number' },
    render: (_args, value) => `总和为 ${String(value)}`,
  },
  async execute(args) {
    return (args.numbers as number[]).reduce((a, b) => a + b, 0)
  },
})

test('defineTool 缺少 name 或 description 抛错', () => {
  // 验证契约完整性：没有身份描述的工具无法被模型信任。
  assert.throws(() => defineTool({ name: '', description: 'x', parameters: { type: 'object', properties: {} }, execute: async () => 1 }), /name 与 description/)
})

test('缺必填参数与类型错误都被拒绝', async () => {
  // 验证框架校验：工具内部不用自己写 if。
  const registry = new ToolRegistry()
  registry.register(sumTool)
  await assert.rejects(() => registry.execute('sum_numbers', {}), /缺少必填参数: numbers/)
  await assert.rejects(() => registry.execute('sum_numbers', { numbers: 'not-array' }), /参数 numbers 类型应为 array/)
})

test('正常执行并渲染输出', async () => {
  // 验证执行 + render：text 是渲染后的文本，value 是原始结果。
  const registry = new ToolRegistry()
  registry.register(sumTool)
  const result = await registry.execute('sum_numbers', { numbers: [1, 2, 3] })
  assert.equal(result.value, 6)
  assert.equal(result.text, '总和为 6')
})

test('listSchemas 暴露 name/description/parameters（供提示词组装）', () => {
  const registry = new ToolRegistry()
  registry.register(sumTool)
  const schemas = registry.listSchemas()
  assert.equal(schemas[0].name, 'sum_numbers')
  assert.ok(schemas[0].parameters.properties.numbers.required)
})
