import assert from 'node:assert/strict'
import { test } from 'vitest'
import { consumeChatCompletionSse } from '@biu/host-llm'

function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

test('consumeChatCompletionSse yields text deltas and usage', async () => {
  const deltas: string[] = []
  const reply = await consumeChatCompletionSse(
    sseBody([
      'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
      'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\n\n',
      'data: [DONE]\n\n',
    ]),
    { onDelta: (text) => { deltas.push(text) } },
  )
  assert.deepEqual(deltas, ['你', '好'])
  assert.equal(reply.content, '你好')
  assert.deepEqual(reply.toolCalls, [])
  assert.deepEqual(reply.usage, { inputTokens: 3, outputTokens: 2, totalTokens: 5 })
})

test('consumeChatCompletionSse accumulates tool_calls by index', async () => {
  const reply = await consumeChatCompletionSse(
    sseBody([
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"clock_now","arguments":""}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{"}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"}"}}]}}]}\n\n',
      'data: [DONE]\n\n',
    ]),
  )
  assert.equal(reply.content, null)
  assert.deepEqual(reply.toolCalls, [{ id: 'c1', name: 'clock_now', arguments: '{}' }])
})

test('consumeChatCompletionSse aborts with signal', async () => {
  const abort = new AbortController()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"a"}}]}\n\n'))
      abort.abort()
    },
  })
  await assert.rejects(() => consumeChatCompletionSse(stream, { signal: abort.signal }), /cancelled/)
})
