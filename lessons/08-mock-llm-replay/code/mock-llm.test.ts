import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FixtureStore, MockLlm, keyOf } from './mock-llm.ts'
import type { ChatMessage } from './types.ts'

const helloPath = new URL('./fixtures/hello.jsonl', import.meta.url).pathname
const toolCallPath = new URL('./fixtures/tool-call.jsonl', import.meta.url).pathname

test('FixtureStore 从 JSONL 加载并按 key 命中', () => {
  const store = FixtureStore.fromFiles([helloPath])
  assert.ok(store.has('你好'))
  const fixture = store.take('你好')
  assert.equal(fixture?.content, '[mock] 你好！这是录制的回复。')
  assert.ok(!store.has('你好'), '消费后队列应清空')
})

test('keyOf 取最后一条 user 消息', () => {
  const messages: ChatMessage[] = [
    { role: 'user', content: '第一问' },
    { role: 'assistant', content: '第一答' },
    { role: 'user', content: '第二问' },
  ]
  assert.equal(keyOf(messages), '第二问')
})

test('同 key 多条 fixture 按序消费', async () => {
  const store = FixtureStore.fromFiles([toolCallPath])
  const mock = new MockLlm(store)
  const first = await mock.chat([{ role: 'user', content: '帮我 echo hi' }])
  assert.equal(first.toolCalls[0].name, 'echo')
  const second = await mock.chat([{ role: 'user', content: '帮我 echo hi' }])
  assert.equal(second.toolCalls.length, 0)
  assert.match(second.content, /结果是 hi/)
})

test('未命中抛错，fallback 可兜底', async () => {
  const mock = new MockLlm(new FixtureStore())
  await assert.rejects(
    () => mock.chat([{ role: 'user', content: '没录过' }]),
    /mock 未命中: 没录过/,
  )
  const fallback = new MockLlm(new FixtureStore(), '[fallback] 兜底回复')
  const reply = await fallback.chat([{ role: 'user', content: '没录过' }])
  assert.match(reply.content, /fallback/)
})
