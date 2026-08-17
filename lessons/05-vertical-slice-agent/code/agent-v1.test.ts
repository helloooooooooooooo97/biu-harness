import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AgentV1 } from './agent-v1.ts'
import type { ChatMessage } from './chat-client.ts'

// 本文件测 AgentV1（最小 agent loop）：
//   ① 正常往返（reply + messages 结构）；② 请求体格式（URL/model/history 顺序）。
// 网络全部通过注入的假 fetch 隔离，不发起真实请求。

function fakeFetch(response: unknown): typeof fetch {
  // 假 fetch：不管收到什么请求，都返回预设的 JSON 响应。
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
  // 黄金路径：假响应 content 应成为 reply，且 messages = [user, assistant]。
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
  // 验证发出去的请求：URL 是 /chat/completions、model 正确、history 在前、新 prompt 在后。
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
