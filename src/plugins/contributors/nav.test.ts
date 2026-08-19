import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as slots from '../registry/slots.ts'
import * as nav from './nav.tsx'
import * as shell from '../orchestration/shell.tsx'

test('fills sidebar', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(nav)
  await ctx.plugin(shell)
  assert.equal(ctx.slots.list('sidebar')[0]?.id, 'nav')
})
