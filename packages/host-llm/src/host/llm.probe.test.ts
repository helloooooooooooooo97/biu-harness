import assert from 'node:assert/strict'
import { test } from 'vitest'
import { resolveModelsListUrl, resolveChatCompletionsUrl } from '@biu/host-llm'

test('resolveModelsListUrl derives from baseUrl', () => {
  assert.equal(resolveModelsListUrl('https://api.openai.com/v1', 'openai'), 'https://api.openai.com/v1/models')
  assert.equal(
    resolveModelsListUrl('https://api.closeai-asia.com/v1/chat/completions', 'openai'),
    'https://api.closeai-asia.com/v1/models',
  )
  assert.equal(resolveModelsListUrl(undefined, 'deepseek'), 'https://api.deepseek.com/models')
})

test('resolveChatCompletionsUrl still works alongside models url', () => {
  assert.equal(
    resolveChatCompletionsUrl('https://api.openai.com/v1', 'openai'),
    'https://api.openai.com/v1/chat/completions',
  )
})
