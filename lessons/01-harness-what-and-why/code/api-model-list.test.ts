import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ModelClient } from './api-model-list.ts'

// 本文件测 ModelClient（模型清单客户端）：
//   ① parse：响应归一化；② 无 key 走内置清单；③ 有 key 走 fake fetch；④ 错误路径。

test('parse 归一化 data 数组并排序', () => {
  // 验证 parse() 把任意响应形状（data 数组）转成 ModelInfo[] 并按 id 排序。
  const models = ModelClient.parse({
    data: [
      { id: 'deepseek-reasoner', owned_by: 'deepseek' },
      { id: 'deepseek-chat', owned_by: 'deepseek' },
    ],
  })
  assert.deepEqual(
    models.map((m) => m.id),
    ['deepseek-chat', 'deepseek-reasoner'],
  )
})

test('无 API key 时走内置清单', async () => {
  // 验证缺 key 时 list() 返回 fallback（内置清单），不发起任何网络请求。
  const client = new ModelClient({ apiKey: '' })
  const { source, models } = await client.list()
  assert.equal(source, 'fallback')
  assert.ok(models.length >= 2)
})

test('有 API key 时走真实接口（fake fetch）', async () => {
  // 验证有 key 时走 fetchImpl 请求 /models 并正确解析响应（source === 'api'）。
  const fakeFetch = async (): Promise<Response> => ({
    ok: true,
    status: 200,
    async json() {
      return { data: [{ id: 'deepseek-chat', owned_by: 'deepseek' }] }
    },
    async text() {
      return ''
    },
  } as Response)
  const client = new ModelClient({ apiKey: 'sk-test', fetchImpl: fakeFetch })
  const { source, models } = await client.list()
  assert.equal(source, 'api')
  assert.equal(models[0].id, 'deepseek-chat')
})

test('API 报错时抛出带状态码的错误', async () => {
  // 验证 HTTP 4xx 时抛出带状态码的错误，而不是静默返回空结果。
  const fakeFetch = async (): Promise<Response> => ({
    ok: false,
    status: 401,
    async json() {
      return {}
    },
    async text() {
      return 'Unauthorized'
    },
  } as Response)
  const client = new ModelClient({ apiKey: 'bad', fetchImpl: fakeFetch })
  await assert.rejects(() => client.list(), /HTTP 401/)
})
