import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AdapterRegistry, assemble, type StreamChunk } from './index.ts'

// 本文件测 llm 适配器接缝：注册表 + 流式组装。

test('registry 注册/取用/重名保护', () => {
  const registry = new AdapterRegistry()
  const adapter = {
    provider: 'mock',
    async *stream() {
      yield { type: 'text', text: 'hi' } as StreamChunk
    },
  }
  registry.register(adapter)
  assert.equal(registry.get('mock'), adapter)
  assert.throws(() => registry.register(adapter), /适配器已存在/)
})

test('assemble 合并文本与 tool-call 增量', async () => {
  const message = await assemble((async function* () {
    yield { type: 'text', text: '你' }
    yield { type: 'tool-call-delta', id: 'c1', name: 'echo', argumentsDelta: '{"text":"hi"}' }
    yield { type: 'finish', reason: 'tool_calls' }
  })())
  assert.deepEqual(
    message.content.map((b) => b.type),
    ['text', 'tool-call'],
  )
})
