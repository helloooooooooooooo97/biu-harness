import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FixtureStore, MockLlm, keyOf } from './mock-llm.ts'
import type { ChatMessage } from './types.ts'

// 本文件测 MockLlm / FixtureStore（录放 mock）：
//   ① fixture 加载与命中；② key 取最后一条 user 消息；③ 同 key 按序消费；④ 未命中抛错 + fallback 兜底。

const helloPath = new URL('./fixtures/hello.jsonl', import.meta.url).pathname
const toolCallPath = new URL('./fixtures/tool-call.jsonl', import.meta.url).pathname

test('FixtureStore 从 JSONL 加载并按 key 命中', () => {
  // 验证 fromFiles 能从 JSONL 加载，take() 消费后队列清空（has 变 false）。
  const store = FixtureStore.fromFiles([helloPath])
  assert.ok(store.has('你好'))
  const fixture = store.take('你好')
  assert.equal(fixture?.content, '[mock] 你好！这是录制的回复。')
  assert.ok(!store.has('你好'), '消费后队列应清空')
})

test('keyOf 取最后一条 user 消息', () => {
  // 验证命中键的规则：取 messages 里最后一条 user 角色的 content。
  const messages: ChatMessage[] = [
    { role: 'user', content: '第一问' },
    { role: 'assistant', content: '第一答' },
    { role: 'user', content: '第二问' },
  ]
  assert.equal(keyOf(messages), '第二问')
})

test('同 key 多条 fixture 按序消费', async () => {
  // 验证队列语义：同 key 两条 fixture，第一次命中返回工具调用、第二次返回最终回答——能复现多步循环。
  const store = FixtureStore.fromFiles([toolCallPath])
  const mock = new MockLlm(store)
  const first = await mock.chat([{ role: 'user', content: '帮我 echo hi' }])
  assert.equal(first.toolCalls[0].name, 'echo')
  const second = await mock.chat([{ role: 'user', content: '帮我 echo hi' }])
  assert.equal(second.toolCalls.length, 0)
  assert.match(second.content, /结果是 hi/)
})

test('未命中抛错，fallback 可兜底', async () => {
  // 验证未命中行为：默认抛"mock 未命中: <key>"（失败要响亮）；配置 fallback 时返回兜底文本。
  const mock = new MockLlm(new FixtureStore())
  await assert.rejects(
    () => mock.chat([{ role: 'user', content: '没录过' }]),
    /mock 未命中: 没录过/,
  )
  const fallback = new MockLlm(new FixtureStore(), '[fallback] 兜底回复')
  const reply = await fallback.chat([{ role: 'user', content: '没录过' }])
  assert.match(reply.content, /fallback/)
})
