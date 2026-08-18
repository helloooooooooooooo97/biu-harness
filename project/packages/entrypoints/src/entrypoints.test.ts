import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HeadlessRunner, JsonRpcServer, type LlmClient } from './index.ts'

// 本文件测入口：headless 与 JSON-RPC。

const mockLlm: LlmClient = {
  async chat() {
    return { content: '回答', toolCalls: [] }
  },
}

test('headless 返回最终回答', async () => {
  assert.equal(await new HeadlessRunner(mockLlm).run('hi'), '回答')
})

test('JSON-RPC 成功与未知方法', async () => {
  const server = new JsonRpcServer({ run: async (p) => `收到: ${String(p?.prompt ?? '')}` })
  const ok = JSON.parse(await server.handleLine('{"id":1,"method":"run","params":{"prompt":"x"}}'))
  assert.equal(ok.result, '收到: x')
  const err = JSON.parse(await server.handleLine('{"id":2,"method":"nope"}'))
  assert.match(err.error.message, /未知方法/)
})
