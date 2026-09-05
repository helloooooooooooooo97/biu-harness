import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import * as systemPrompt from '@biu/host-system-prompt'
import * as tools from '@biu/host-tools'
import * as pick from './index.ts'

test('registers pick instructions on the system prompt', async () => {
  const ctx = new Context()
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(pick)
  const text = ctx.systemPrompt.assemble()
  assert.match(text, /<pick/)
  assert.match(text, /kind\/id/)
})
