import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as slots from '../registry/slots.ts'
import * as about from './about.tsx'
import * as shell from '../orchestration/shell.tsx'

test('fills stage with about', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(about)
  await ctx.plugin(shell)
  assert.equal(ctx.slots.list('stage')[0]?.id, 'about')
})
