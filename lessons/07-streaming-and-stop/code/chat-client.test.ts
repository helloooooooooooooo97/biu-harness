import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ChatClient } from './chat-client.ts'
import { sseResponse } from './test-utils.ts'

test('streamChat 逐段产出文本并以 [DONE] 结束', async () => {
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
