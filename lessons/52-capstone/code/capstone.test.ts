import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CapstoneHarness } from './capstone-starter.ts'
import type { LlmClient } from './types.ts'

// 本文件测结业骨架：① run；② ping；③ 未知方法。

const mockLlm: LlmClient = {
  async chat() {
    return { content: '结业回答', toolCalls: [] }
  },
}

test('CapstoneHarness run 返回 mock 回答', async () => {
  const harness = new CapstoneHarness({ llm: mockLlm })
  const response = await harness.handle('{"id":1,"method":"run","params":{"prompt":"任务"}}')
  assert.equal(JSON.parse(response).result, '结业回答')
})

test('ping 可用', async () => {
  const harness = new CapstoneHarness({ llm: mockLlm })
  const response = await harness.handle('{"id":2,"method":"ping"}')
  assert.equal(JSON.parse(response).result, 'pong')
})

test('未知方法返回错误', async () => {
  const harness = new CapstoneHarness({ llm: mockLlm })
  const response = await harness.handle('{"id":3,"method":"nope"}')
  assert.match(JSON.parse(response).error.message, /未知方法/)
})
