import assert from 'node:assert/strict'
import { test } from 'vitest'
import { formatUsage, parseProviderUsage } from './llm.ts'

test('parseProviderUsage reads OpenAI-style fields', () => {
  assert.deepEqual(parseProviderUsage({ prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 }), {
    inputTokens: 12,
    outputTokens: 4,
    totalTokens: 16,
  })
})

test('parseProviderUsage reads DeepSeek cache hit tokens', () => {
  assert.deepEqual(
    parseProviderUsage({
      prompt_tokens: 100,
      completion_tokens: 20,
      prompt_cache_hit_tokens: 40,
    }),
    {
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 40,
    },
  )
})

test('parseProviderUsage ignores garbage', () => {
  assert.equal(parseProviderUsage(null), undefined)
  assert.equal(parseProviderUsage({ foo: 1 }), undefined)
})

test('formatUsage is compact', () => {
  assert.equal(formatUsage({ inputTokens: 10, outputTokens: 3 }), '10→3')
  assert.equal(formatUsage({ inputTokens: 10, outputTokens: 3, cacheReadTokens: 2 }), '10→3 · cache 2')
})
