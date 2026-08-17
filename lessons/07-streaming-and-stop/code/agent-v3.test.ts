import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AgentV3 } from './agent-v3.ts'
import { ChatClient } from './chat-client.ts'
import { sseResponse } from './test-utils.ts'

// 本文件测 AgentV3（流式消费层）：
//   ① length 截断信号透传；② 正常汇总（reply/chunks/stopReason）；③ MOCK_LLM 流式路径。

test('finish_reason=length 被透传', async () => {
  // 验证截断：finish_reason=length 时 stopReason 必须是 length（而不是默认的 stop），reply 只到截断处。
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
  // 黄金路径：两段文本按序拼接成"你好世界"，chunks=2，stopReason=stop。
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
  // 验证 mock 分支也走流式路径并正常结束（reply 含 mock、stopReason=stop），最后恢复环境变量。
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
