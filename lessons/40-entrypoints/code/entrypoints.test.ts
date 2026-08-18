import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HeadlessRunner } from './headless.ts'
import { JsonRpcServer } from './jsonrpc.ts'
import type { LlmClient } from './types.ts'

// 本文件测入口：① headless；② JSON-RPC 成功；③ 未知方法；④ 非法 JSON。

const mockLlm: LlmClient = {
  async chat() {
    return { content: '最终回答', toolCalls: [] }
  },
}

test('headless 返回最终回答', async () => {
  const runner = new HeadlessRunner({ llm: mockLlm })
  assert.equal(await runner.run('hi'), '最终回答')
})

test('JSON-RPC 成功响应', async () => {
  const server = new JsonRpcServer({
    run: async (params) => `收到: ${String(params?.prompt ?? '')}`,
  })
  const response = await server.handleLine('{"id":1,"method":"run","params":{"prompt":"hi"}}')
  assert.deepEqual(JSON.parse(response), { jsonrpc: '2.0', id: 1, result: '收到: hi' })
})

test('JSON-RPC 未知方法返回 error', async () => {
  const server = new JsonRpcServer({})
  const response = await server.handleLine('{"id":2,"method":"nope"}')
  const parsed = JSON.parse(response) as { error: { message: string } }
  assert.match(parsed.error.message, /未知方法: nope/)
})

test('JSON-RPC 非法 JSON 返回解析错误', async () => {
  const server = new JsonRpcServer({})
  const response = await server.handleLine('not-json')
  assert.match(JSON.parse(response).error.message, /解析错误/)
})
