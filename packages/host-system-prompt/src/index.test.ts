import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import * as tools from '@biu/host-tools'
import * as systemPrompt from './index.ts'

test('system prompt sections assemble in id order', async () => {
  const ctx = new Context()
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  ctx.systemPrompt.register('z-tail', '尾部')
  ctx.systemPrompt.register('a-head', '头部')
  const text = ctx.systemPrompt.assemble()
  assert.match(text, /头部[\s\S]*尾部/)
  assert.match(text, /可用工具/)
})
