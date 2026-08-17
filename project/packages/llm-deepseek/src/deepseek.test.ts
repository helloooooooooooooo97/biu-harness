import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assemble } from '@mini-dsh/llm'
import { DeepSeekAdapter } from './index.ts'

// 本文件测 DeepSeekAdapter：reasoning + 文本映射。

function sseResponse(lines: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(`${line}\n\n`))
      controller.close()
    },
  })
  return { ok: true, status: 200, body, async json() { return {} }, async text() { return '' } } as Response
}

test('解析 reasoning 与文本', async () => {
  const fetchImpl = async (): Promise<Response> => sseResponse([
    'data: {"choices":[{"delta":{"reasoning_content":"想"}}]}',
    'data: {"choices":[{"delta":{"content":"答"}}]}',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
    'data: [DONE]',
  ])
  const adapter = new DeepSeekAdapter({ apiKey: 'sk-test', fetchImpl })
  const message = await assemble(adapter.stream([{ role: 'user', content: [{ type: 'text', text: 'hi' }] }]))
  assert.deepEqual(
    message.content.map((b) => b.type),
    ['reasoning', 'text'],
  )
})
