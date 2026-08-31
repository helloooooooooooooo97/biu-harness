import assert from 'node:assert/strict'
import { afterEach, test, vi } from 'vitest'
import {
  resolveModelsListUrl,
  resolveChatCompletionsUrl,
  listLlmModels,
} from '@biu/host-llm'

function mockFetch(body: unknown, status = 200) {
  const fn = async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  vi.stubGlobal('fetch', fn)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('resolveModelsListUrl derives from baseUrl', () => {
  assert.equal(resolveModelsListUrl('https://api.openai.com/v1', 'openai'), 'https://api.openai.com/v1/models')
  assert.equal(
    resolveModelsListUrl('https://api.closeai-asia.com/v1/chat/completions', 'openai'),
    'https://api.closeai-asia.com/v1/models',
  )
  assert.equal(resolveModelsListUrl(undefined, 'deepseek'), 'https://api.deepseek.com/models')
})

test('listLlmModels parses openai-compat /models payload', async () => {
  mockFetch({ data: [{ id: 'gpt-4o', owned_by: 'openai' }, { id: 'gpt-4o-mini' }] })
  const models = await listLlmModels({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o-mini' })
  assert.deepEqual(models, [
    { id: 'gpt-4o', ownedBy: 'openai' },
    { id: 'gpt-4o-mini' },
  ])
})

test('listLlmModels parses ollama /models payload (no auth)', async () => {
  mockFetch({ models: [{ name: 'llama3.2' }, { name: 'qwen3' }] })
  const models = await listLlmModels({ provider: 'openai', apiKey: '', model: 'qwen3', baseUrl: 'http://localhost:11434' })
  assert.deepEqual(models, [{ id: 'llama3.2' }, { id: 'qwen3' }])
})

test('listLlmModels returns null for anthropic (no list endpoint)', async () => {
  assert.equal(
    await listLlmModels({ provider: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-3-5-sonnet-20241022' }),
    null,
  )
})

test('listLlmModels throws on non-ok http status', async () => {
  mockFetch({ error: { message: 'invalid api key' } }, 401)
  await assert.rejects(
    listLlmModels({ provider: 'deepseek', apiKey: 'bad', model: 'deepseek-chat' }),
    /invalid api key/,
  )
})

test('resolveChatCompletionsUrl still works alongside models url', () => {
  assert.equal(
    resolveChatCompletionsUrl('https://api.openai.com/v1', 'openai'),
    'https://api.openai.com/v1/chat/completions',
  )
})
