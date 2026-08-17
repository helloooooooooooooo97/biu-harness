import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AdapterRegistry, assemble, type LlmAdapter, type StreamChunk } from './llm.ts'

// 本文件测适配器接缝：① 注册/取用；② 重名；③ 组装；④ 自定义 adapter。

test('registry 注册/取用/列表/重名保护', async () => {
  const registry = new AdapterRegistry()
  const mock: LlmAdapter = {
    provider: 'mock',
    async *stream() {
      yield { type: 'text', text: 'hi' }
      yield { type: 'finish', reason: 'stop' }
    },
  }
  const off = registry.register(mock)
  assert.deepEqual(registry.list(), ['mock'])
  assert.equal(registry.get('mock'), mock)
  assert.throws(() => registry.register(mock), /适配器已存在/)
  off()
  assert.throws(() => registry.get('mock'), /未知适配器/)
})

test('assemble 合并文本并拼接 tool-call 增量', async () => {
  const chunks: StreamChunk[] = [
    { type: 'text', text: '你' },
    { type: 'text', text: '好' },
    { type: 'tool-call-delta', id: 'c1', name: 'echo', argumentsDelta: '{"tex' },
    { type: 'tool-call-delta', id: 'c1', argumentsDelta: 't":"hi"}' },
    { type: 'finish', reason: 'tool_calls' },
  ]
  const message = await assemble((async function* () {
    for (const chunk of chunks) yield chunk
  })())
  assert.equal(message.role, 'assistant')
  assert.deepEqual(
    message.content.map((b) => b.type),
    ['text', 'tool-call'],
  )
  const call = message.content[1]
  if (call.type === 'tool-call') {
    assert.equal(call.arguments, '{"text":"hi"}')
  }
})

test('assemble 保留 reasoning 块', async () => {
  const message = await assemble((async function* () {
    yield { type: 'reasoning', text: '让我想想' }
    yield { type: 'text', text: '答案' }
    yield { type: 'finish', reason: 'stop' }
  })())
  assert.deepEqual(
    message.content.map((b) => b.type),
    ['reasoning', 'text'],
  )
})
