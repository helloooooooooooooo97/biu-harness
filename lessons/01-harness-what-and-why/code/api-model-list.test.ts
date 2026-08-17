import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ModelClient } from './api-model-list.ts'

test('parse 归一化 data 数组并排序', () => {
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
  const client = new ModelClient({ apiKey: '' })
  const { source, models } = await client.list()
  assert.equal(source, 'fallback')
  assert.ok(models.length >= 2)
})

test('有 API key 时走真实接口（fake fetch）', async () => {
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
