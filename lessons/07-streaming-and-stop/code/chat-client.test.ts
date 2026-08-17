import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ChatClient } from './chat-client.ts'
import { sseResponse } from './test-utils.ts'

// 本文件测 ChatClient.streamChat（流式传输层）：
//   ① 正常流（文本 + [DONE]）；② 预中止抛 AbortError；③ HTTP 4xx。不测 SseParser（见 sse-parser.test.ts）。

test('streamChat 逐段产出文本并以 [DONE] 结束', async () => {
  // 黄金路径：4 条 SSE 事件 → 依次 yield 文本"你""好" + finish stop，[DONE] 后流结束。
  const fetchImpl = async (): Promise<Response> => sseResponse([
    'data: {"choices":[{"delta":{"content":"你"}}]}',
    'data: {"choices":[{"delta":{"content":"好"}}]}',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
    'data: [DONE]',
  ])
  const client = new ChatClient({ apiKey: 'sk-test', fetchImpl })
  const texts: string[] = []
  let finish = ''
  for await (const event of client.streamChat([{ role: 'user', content: 'hi' }])) {
    if (event.type === 'text') texts.push(event.text)
    else finish = event.reason
  }
  assert.deepEqual(texts, ['你', '好'])
  assert.equal(finish, 'stop')
})

test('预中止的 signal 直接抛 AbortError', async () => {
  // 验证取消：signal 已 abort 时，streamChat 在发请求前就抛 AbortError（错误名必须精确匹配）。
  const controller = new AbortController()
  controller.abort()
  const client = new ChatClient({ apiKey: 'sk-test' })
  await assert.rejects(
    async () => {
      for await (const _ of client.streamChat([{ role: 'user', content: 'hi' }], { signal: controller.signal })) {
        // 不应有产出
      }
    },
    (err: unknown) => (err as Error).name === 'AbortError',
  )
})

test('HTTP 4xx 在流式请求时抛错', async () => {
  // 验证错误路径：流式请求遇到 402 也要抛 /HTTP 402/，不能把错误响应当流来读。
  const fetchImpl = async (): Promise<Response> => ({
    ok: false,
    status: 402,
    async json() {
      return {}
    },
    async text() {
      return 'Quota exceeded'
    },
  }) as Response
  const client = new ChatClient({ apiKey: 'bad', fetchImpl })
  await assert.rejects(
    async () => {
      for await (const _ of client.streamChat([{ role: 'user', content: 'hi' }])) {
        // 不应有产出
      }
    },
    /HTTP 402/,
  )
})
