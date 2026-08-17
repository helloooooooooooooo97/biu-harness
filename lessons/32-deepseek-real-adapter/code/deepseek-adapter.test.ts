import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DeepSeekAdapter } from './deepseek-adapter.ts'
import { assemble } from './llm.ts'

// 本文件测 DeepSeekAdapter：① reasoning/文本/tool_calls 映射；② 4xx 错误；③ 预中止。

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

test('流式解析：reasoning + 文本 + tool_calls 分片', async () => {
  const fetchImpl = async (): Promise<Response> => sseResponse([
    'data: {"choices":[{"delta":{"reasoning_content":"让我想想"}}]}',
    'data: {"choices":[{"delta":{"content":"我来执行。"}}]}',
    'data: {"choices":[{"delta":{"tool_calls":[{"id":"c1","function":{"name":"echo","arguments":"{\\"text\\":\\"hi\\"}"}}]}}]}',
    'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
    'data: [DONE]',
  ])
  const adapter = new DeepSeekAdapter({ apiKey: 'sk-test', fetchImpl })
  const message = await assemble(adapter.stream([{ role: 'user', content: [{ type: 'text', text: 'hi' }] }]))
  assert.deepEqual(
    message.content.map((b) => b.type),
    ['reasoning', 'text', 'tool-call'],
  )
  const reasoning = message.content[0]
  const call = message.content[2]
  if (reasoning.type === 'reasoning') assert.equal(reasoning.text, '让我想想')
  if (call.type === 'tool-call') {
    assert.equal(call.name, 'echo')
    assert.equal(call.arguments, '{"text":"hi"}')
  }
})

test('HTTP 4xx 抛错', async () => {
  const fetchImpl = async (): Promise<Response> => ({
    ok: false,
    status: 401,
    async json() { return {} },
    async text() { return 'Unauthorized' },
  }) as Response
  const adapter = new DeepSeekAdapter({ apiKey: 'bad', fetchImpl })
  await assert.rejects(
    async () => {
      for await (const _ of adapter.stream([{ role: 'user', content: [{ type: 'text', text: 'hi' }] }])) {
        // 不应有产出
      }
    },
    /HTTP 401/,
  )
})

test('预中止的 signal 抛 AbortError', async () => {
  const controller = new AbortController()
  controller.abort()
  const adapter = new DeepSeekAdapter({ apiKey: 'sk-test' })
  await assert.rejects(
    async () => {
      for await (const _ of adapter.stream(
        [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
        { signal: controller.signal },
      )) {
        // 不应有产出
      }
    },
    (err: unknown) => (err as Error).name === 'AbortError',
  )
})
