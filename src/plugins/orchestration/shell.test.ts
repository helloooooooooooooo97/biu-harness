import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as slots from '../registry/slots.ts'
import * as shell from './shell.tsx'

test('declares sidebar and stage', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(shell)
  assert.equal(ctx.slots.specOf('sidebar')?.kind, 'single')
  assert.equal(ctx.slots.specOf('stage')?.kind, 'list')
  assert.equal(ctx.slots.list('root').length, 1)
})
