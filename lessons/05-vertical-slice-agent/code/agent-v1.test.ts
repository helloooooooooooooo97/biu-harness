import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AgentV1 } from './agent-v1.ts'
import { ChatClient, type ChatMessage } from './chat-client.ts'

function fakeFetch(response: unknown, { status = 200 } = {}): typeof fetch {
  return async () => ({
    ok: status >= 200 && status < 400,
    status,
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

test('缺少 key 且未开 mock 时报错', async () => {
  const oldKey = process.env.DEEPSEEK_API_KEY
  const oldMock = process.env.MOCK_LLM
  delete process.env.DEEPSEEK_API_KEY
  delete process.env.MOCK_LLM
  try {
    const client = new ChatClient()
    await assert.rejects(
      () => client.chat([{ role: 'user', content: 'hi' }]),
      /DEEPSEEK_API_KEY/,
    )
  } finally {
    if (oldKey) process.env.DEEPSEEK_API_KEY = oldKey
    if (oldMock) process.env.MOCK_LLM = oldMock
  }
})

test('MOCK_LLM=1 时无 key 也能返回 mock 回复', async () => {
  const oldKey = process.env.DEEPSEEK_API_KEY
  const oldMock = process.env.MOCK_LLM
  delete process.env.DEEPSEEK_API_KEY
  process.env.MOCK_LLM = '1'
  try {
    const client = new ChatClient()
    const reply = await client.chat([{ role: 'user', content: '你好' }])
    assert.match(reply, /mock/)
  } finally {
    if (oldKey) process.env.DEEPSEEK_API_KEY = oldKey
    if (oldMock) process.env.MOCK_LLM = oldMock
    else delete process.env.MOCK_LLM
  }
})

test('API 4xx 抛出带状态码的错误', async () => {
  const fetchImpl = async (): Promise<Response> => ({
    ok: false,
    status: 401,
    async json() {
      return {}
    },
    async text() {
      return 'Invalid API key'
    },
  }) as Response
  const client = new ChatClient({ apiKey: 'bad', fetchImpl })
  await assert.rejects(
    () => client.chat([{ role: 'user', content: 'hi' }]),
    /HTTP 401/,
  )
})
