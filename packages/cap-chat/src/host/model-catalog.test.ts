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

test('normalizeBaseUrl strips trailing slash', () => {
  assert.equal(normalizeBaseUrl(' https://a.com/v1/ '), 'https://a.com/v1')
})
