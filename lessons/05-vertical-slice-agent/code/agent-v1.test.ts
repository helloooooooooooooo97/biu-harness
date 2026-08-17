import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AgentV1 } from './agent-v1.ts'
import type { ChatMessage } from './chat-client.ts'

function fakeFetch(response: unknown): typeof fetch {
  return async () => ({
    ok: true,
    status: 200,
    async json() {
      return response
    },
    async text() {
      return JSON.stringify(response)
    },
  }) as Response
}

test('AgentV1.run 返回 reply 并追加 assistant 消息', async () => {
  const fetchImpl = fakeFetch({
    choices: [{ message: { role: 'assistant', content: '你好，我是 DeepSeek。' } }],
  })
  const agent = new AgentV1({ apiKey: 'sk-test', fetchImpl })
  const out = await agent.run('你好')
  assert.equal(out.reply, '你好，我是 DeepSeek。')
  assert.equal(out.messages.length, 2)
  assert.equal(out.messages[0].role, 'user')
  assert.equal(out.messages[1].role, 'assistant')
})

test('请求体包含 model 与完整 messages（含 history）', async () => {
  let captured: { url: string; init: RequestInit } | undefined
  const fetchImpl: typeof fetch = async (input, init) => {
    captured = { url: String(input), init: init ?? {} }
    return {
      ok: true,
      status: 200,
      async json() {
        return { choices: [{ message: { content: 'ok' } }] }
      },
      async text() {
        return ''
      },
    } as Response
  }
  const history: ChatMessage[] = [{ role: 'assistant', content: '之前的回答' }]
  const agent = new AgentV1({ apiKey: 'sk-test', fetchImpl })
  await agent.run('hi', history)

  assert.ok(captured)
  assert.match(captured.url, /\/chat\/completions$/)
  const body = JSON.parse(String(captured.init.body)) as {
    model: string
    messages: ChatMessage[]
  }
  assert.equal(body.model, 'deepseek-chat')
  assert.equal(body.messages.length, 2)
  assert.equal(body.messages[0].role, 'assistant')
  assert.equal(body.messages[1].role, 'user')
})
