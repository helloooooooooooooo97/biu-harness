import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AgentV3 } from './agent-v3.ts'
import { ChatClient } from './chat-client.ts'
import { sseResponse } from './test-utils.ts'

test('finish_reason=length 被透传', async () => {
  const fetchImpl = async (): Promise<Response> => sseResponse([
    'data: {"choices":[{"delta":{"content":"前半"}}]}',
    'data: {"choices":[{"delta":{},"finish_reason":"length"}]}',
    'data: [DONE]',
  ])
  const agent = new AgentV3({ client: new ChatClient({ apiKey: 'sk-test', fetchImpl }) })
  const out = await agent.run('hi')
  assert.equal(out.reply, '前半')
  assert.equal(out.stopReason, 'length')
})

test('AgentV3 汇总流式结果', async () => {
  const fetchImpl = async (): Promise<Response> => sseResponse([
    'data: {"choices":[{"delta":{"content":"你好"}}]}',
    'data: {"choices":[{"delta":{"content":"世界"}}]}',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
    'data: [DONE]',
  ])
  const agent = new AgentV3({ client: new ChatClient({ apiKey: 'sk-test', fetchImpl }) })
  const out = await agent.run('hi')
  assert.equal(out.reply, '你好世界')
  assert.equal(out.chunks, 2)
  assert.equal(out.stopReason, 'stop')
})

test('MOCK_LLM=1 时流式 mock 正常结束', async () => {
  const oldKey = process.env.DEEPSEEK_API_KEY
  const oldMock = process.env.MOCK_LLM
  delete process.env.DEEPSEEK_API_KEY
  process.env.MOCK_LLM = '1'
  try {
    const agent = new AgentV3()
    const out = await agent.run('你好')
    assert.match(out.reply, /mock/)
    assert.equal(out.stopReason, 'stop')
  } finally {
    if (oldKey) process.env.DEEPSEEK_API_KEY = oldKey
    if (oldMock) process.env.MOCK_LLM = oldMock
    else delete process.env.MOCK_LLM
  }
})
