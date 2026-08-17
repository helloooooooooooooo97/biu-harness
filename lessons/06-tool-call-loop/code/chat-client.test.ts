import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ChatClient, toWire } from './chat-client.ts'
import { echoCall, fakeFetchSequence } from './test-utils.ts'

// 本文件测 ChatClient v2（工具调用传输层）：
//   ① tool_calls 解析；② toWire 序列化（内部格式 → wire 格式）；③ 4xx 错误。

test('ChatClient 解析 tool_calls（fake fetch 直测）', async () => {
  // 验证响应里的 tool_calls 被解析成内部 ToolCall，且 arguments 保持原始 JSON 字符串。
  const fetchImpl = fakeFetchSequence([
    { choices: [{ message: echoCall('c1', '{"text":"x"}') }] },
  ])
  const client = new ChatClient({ apiKey: 'sk-test', fetchImpl })
  const reply = await client.chat([{ role: 'user', content: 'hi' }])
  assert.equal(reply.toolCalls[0].name, 'echo')
  assert.equal(reply.toolCalls[0].arguments, '{"text":"x"}')
})

test('toWire 把内部消息正确序列化', () => {
  // 验证内部格式 → wire 格式：toolCalls → tool_calls(+type/function 嵌套)、toolCallId → tool_call_id。
  const wire = toWire([
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'echo', arguments: '{}' }] },
    { role: 'tool', toolCallId: 'c1', content: 'ok' },
  ]) as Array<Record<string, unknown>>
  const assistant = wire[1] as { tool_calls: Array<{ id: string }> }
  assert.equal(assistant.tool_calls[0].id, 'c1')
  assert.equal((wire[2] as { tool_call_id: string }).tool_call_id, 'c1')
})

test('API 4xx 抛出带状态码的错误', async () => {
  // 验证 429 等 4xx 错误被包装成含状态码的异常，而不是返回空回复。
  const fetchImpl = async (): Promise<Response> => ({
    ok: false,
    status: 429,
    async json() {
      return {}
    },
    async text() {
      return 'Rate limit'
    },
  }) as Response
  const client = new ChatClient({ apiKey: 'bad', fetchImpl })
  await assert.rejects(
    () => client.chat([{ role: 'user', content: 'hi' }]),
    /HTTP 429/,
  )
})
