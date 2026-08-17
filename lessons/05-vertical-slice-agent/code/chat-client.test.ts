import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ChatClient } from './chat-client.ts'

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
