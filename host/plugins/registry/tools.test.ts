import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as tools from './tools.ts'

test('invoke missing tool fails; unregister drops the name', async () => {
  const ctx = new Context()
  await ctx.plugin(tools)
  await assert.rejects(() => ctx.tools.invoke('gone'), /unknown tool: gone/)

  const fiber = ctx.plugin({
    inject: ['tools'],
    apply: (c) =>
      c.tools.register({
        name: 'ping',
        description: 'ping',
        parameters: { type: 'object', properties: {} },
        execute: () => 'pong',
      }),
  })
  await fiber
  assert.equal(await ctx.tools.invoke('ping'), 'pong')
  await fiber.dispose()
  await assert.rejects(() => ctx.tools.invoke('ping'), /unknown tool: ping/)
})

test('pre-execute waterfall can deny a call', async () => {
  const ctx = new Context()
  await ctx.plugin(tools)
  ctx.tools.register({
    name: 'boom',
    description: 'boom',
    parameters: { type: 'object', properties: {} },
    execute: () => 'nope',
  })
  ctx.on('tools/pre-execute', (req, next) => ({ ...next(), deny: 'denied: boom' }))
  await assert.rejects(() => ctx.tools.invoke('boom'), /denied: boom/)
})

test('guard can deny before execute', async () => {
  const ctx = new Context()
  await ctx.plugin(tools)
  ctx.tools.register({
    name: 'boom',
    description: 'boom',
    parameters: { type: 'object', properties: {} },
    execute: () => 'nope',
  })
  ctx.tools.guard((req) => ({ ...req, deny: 'denied: boom' }))
  await assert.rejects(() => ctx.tools.invoke('boom'), /denied: boom/)
})
