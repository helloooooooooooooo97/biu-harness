import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as slots from '../registry/slots.ts'
import * as snapshot from '../infrastructure/snapshot.ts'
import * as hello from './hello.tsx'
import * as shell from '../orchestration/shell.tsx'

test('fills stage after shell opens it', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(snapshot)
  await ctx.plugin(hello)
  assert.equal(ctx.slots.list('stage').length, 0)
  await ctx.plugin(shell)
  assert.equal(ctx.slots.list('stage')[0]?.id, 'hello')
})
