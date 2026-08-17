import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FixtureStore, MockLlm, keyOf, toWire } from './index.ts'

// 本文件测 llm-deepseek：① toWire；② keyOf；③ 同 key 按序消费。

test('toWire 把内部消息正确序列化', () => {
  const wire = toWire([
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'echo', arguments: '{}' }] },
    { role: 'tool', toolCallId: 'c1', content: 'ok' },
  ]) as Array<Record<string, unknown>>
  const assistant = wire[1] as { tool_calls: Array<{ id: string }> }
  assert.equal(assistant.tool_calls[0].id, 'c1')
  const tool = wire[2] as { tool_call_id: string }
  assert.equal(tool.tool_call_id, 'c1')
})

test('keyOf 取最后一条 user 消息', () => {
  const messages = [
    { role: 'user', content: '第一问' },
    { role: 'assistant', content: '第一答' },
    { role: 'user', content: '第二问' },
  ] as Parameters<typeof keyOf>[0]
  assert.equal(keyOf(messages), '第二问')
})

test('同 key 多条 fixture 按序消费', async () => {
  const store = new FixtureStore([
    { key: '帮我 echo hi', content: '我来执行。', toolCalls: [{ id: 'c1', name: 'echo', arguments: '{"text":"hi"}' }] },
    { key: '帮我 echo hi', content: '结果是 hi。' },
  ])
  const mock = new MockLlm(store)
  const first = await mock.chat([{ role: 'user', content: '帮我 echo hi' }])
  assert.equal(first.toolCalls[0].name, 'echo')
  const second = await mock.chat([{ role: 'user', content: '帮我 echo hi' }])
  assert.equal(second.toolCalls.length, 0)
  assert.match(second.content, /结果是 hi/)
})
