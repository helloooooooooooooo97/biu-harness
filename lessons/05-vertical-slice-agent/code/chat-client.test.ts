import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ChatClient } from './chat-client.ts'

// 本文件测 ChatClient（LLM 传输层）：
//   ① 缺 key 报错；② MOCK_LLM 分支；③ HTTP 4xx 错误路径。不测 AgentV1（见 agent-v1.test.ts）。

test('缺少 key 且未开 mock 时报错', async () => {
  // 环境隔离：删掉 DEEPSEEK_API_KEY 和 MOCK_LLM 后，chat() 必须以含"缺少 DEEPSEEK_API_KEY"的错误拒绝。
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
  // 验证 mock 分支：MOCK_LLM=1 时无 key 也返回含 "mock" 的文本，且不发网络请求。
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
  // 验证错误路径：假 fetch 返回 401，chat() 必须抛 /HTTP 401/，不能把错误响应当成功解析。
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
