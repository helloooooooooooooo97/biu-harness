import assert from 'node:assert/strict'
import { test } from 'vitest'
import { resolveChatCompletionsUrl, resolveAnthropicMessagesUrl } from '@biu/host-llm'
import {
  LLM_ENDPOINT_PRESETS,
  LLM_MODEL_CATALOG,
  findEndpointPreset,
  normalizeBaseUrl,
} from './model-catalog.ts'

test('resolveChatCompletionsUrl uses defaults when baseUrl missing', () => {
  assert.equal(resolveChatCompletionsUrl(undefined, 'deepseek'), 'https://api.deepseek.com/chat/completions')
  assert.equal(resolveChatCompletionsUrl(undefined, 'openai'), 'https://api.openai.com/v1/chat/completions')
})

test('resolveChatCompletionsUrl appends path and accepts full URL', () => {
  assert.equal(
    resolveChatCompletionsUrl('https://api.closeai-asia.com/v1', 'openai'),
    'https://api.closeai-asia.com/v1/chat/completions',
  )
  assert.equal(
    resolveChatCompletionsUrl('https://gate.example.com/v1/chat/completions/', 'openai'),
    'https://gate.example.com/v1/chat/completions',
  )
})

test('resolveAnthropicMessagesUrl supports custom base', () => {
  assert.equal(resolveAnthropicMessagesUrl(undefined), 'https://api.anthropic.com/v1/messages')
  assert.equal(
    resolveAnthropicMessagesUrl('https://proxy.example.com/anthropic/v1'),
    'https://proxy.example.com/anthropic/v1/messages',
  )
})

test('endpoint presets cover official + relay + local groups', () => {
  const groups = new Set(LLM_ENDPOINT_PRESETS.map((e) => e.group))
  assert.ok(groups.has('official'))
  assert.ok(groups.has('relay'))
  assert.ok(groups.has('local'))
  assert.ok(LLM_ENDPOINT_PRESETS.length >= 30)
  assert.ok(findEndpointPreset('deepseek'))
  assert.ok(findEndpointPreset('openrouter'))
  assert.ok(findEndpointPreset('closeai'))
  assert.ok(findEndpointPreset('ollama'))
})

test('builtin models reference known endpoints', () => {
  const ids = new Set(LLM_ENDPOINT_PRESETS.map((e) => e.id))
  for (const m of LLM_MODEL_CATALOG) {
    assert.ok(ids.has(m.endpointId), `model ${m.id} endpoint ${m.endpointId}`)
  }
})

test('official providers ship a rich model catalog', () => {
  const deepseek = LLM_MODEL_CATALOG.filter((m) => m.endpointId === 'deepseek')
  const openai = LLM_MODEL_CATALOG.filter((m) => m.endpointId === 'openai')
  const anthropic = LLM_MODEL_CATALOG.filter((m) => m.endpointId === 'anthropic')
  assert.ok(deepseek.length >= 3, `deepseek=${deepseek.length}`)
  assert.ok(deepseek.length <= 3, `deepseek should be flash/pro/vision only, got ${deepseek.length}`)
  assert.deepEqual(
    deepseek.map((m) => m.model).sort(),
    ['deepseek-v4-flash', 'deepseek-v4-flash-vision-exp', 'deepseek-v4-pro'].sort(),
  )
  assert.ok(openai.length >= 15, `openai=${openai.length}`)
  assert.ok(anthropic.length >= 8, `anthropic=${anthropic.length}`)
  assert.ok(LLM_MODEL_CATALOG.length >= 100, `total=${LLM_MODEL_CATALOG.length}`)
})

test('relay endpoints share a multi-model pack', () => {
  const closeai = LLM_MODEL_CATALOG.filter((m) => m.endpointId === 'closeai')
  assert.ok(closeai.length >= 15, `closeai=${closeai.length}`)
  assert.ok(closeai.some((m) => m.model === 'gpt-4o'))
  assert.ok(closeai.some((m) => m.model.includes('claude')))
})

test('normalizeBaseUrl strips trailing slash', () => {
  assert.equal(normalizeBaseUrl(' https://a.com/v1/ '), 'https://a.com/v1')
})
