import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as tools from '../registry/tools.ts'
import * as approvals from './approvals.ts'

async function setup() {
  const ctx = new Context()
  await ctx.plugin(tools)
  await ctx.plugin(approvals)
  ctx.tools.register({
    name: 'bash',
    description: 'bash',
    parameters: { type: 'object', properties: { command: { type: 'string' } } },
    execute: () => 'ran',
  })
  ctx.tools.register({
    name: 'echo',
    description: 'echo',
    parameters: { type: 'object', properties: {} },
    execute: () => 'ok',
  })
  return ctx
}

test('hold mode denies sensitive tool until decide(allow)', async () => {
  const ctx = await setup()
  ctx.approvals.mode = 'hold'
  const invoke = ctx.tools.invoke('bash', { command: 'echo' })
  await new Promise((resolve) => setTimeout(resolve, 20))
  const pending = ctx.approvals.list()
  assert.equal(pending.length, 1)
  assert.equal(pending[0]?.name, 'bash')
  ctx.approvals.decide(pending[0]!.id, true)
  assert.equal(await invoke, 'ran')
})

test('hold mode deny blocks sensitive tool', async () => {
  const ctx = await setup()
  ctx.approvals.mode = 'hold'
  const invoke = ctx.tools.invoke('bash', { command: 'echo' })
  await new Promise((resolve) => setTimeout(resolve, 20))
  const [item] = ctx.approvals.list()
  assert.ok(item)
  ctx.approvals.decide(item.id, false)
  await assert.rejects(() => invoke, /denied: bash/)
})

test('hold timeout defaults to deny', async () => {
  const ctx = await setup()
  ctx.approvals.mode = 'hold'
  ctx.approvals.holdTimeoutMs = 30
  await assert.rejects(() => ctx.tools.invoke('bash', { command: 'x' }), /denied: bash/)
})

test('non-sensitive tools skip hold', async () => {
  const ctx = await setup()
  ctx.approvals.mode = 'hold'
  assert.equal(await ctx.tools.invoke('echo'), 'ok')
  assert.equal(ctx.approvals.list().length, 0)
})
