import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../../types.ts'
import * as slots from '../../registry/slots.ts'
import * as snapshot from '../../infrastructure/snapshot.ts'
import * as chat from './index.ts'
import * as shell from '../shell.tsx'

test('one plugin fills thread, composer and settings', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(snapshot)
  await ctx.plugin(chat)
  assert.equal(ctx.slots.list('composer').length, 0)
  await ctx.plugin(shell)
  assert.equal(ctx.slots.list('composer')[0]?.id, 'chat')
  assert.equal(ctx.slots.list('stage').some((item) => item.id === 'chat-thread'), true)
  assert.equal(ctx.slots.list('settings')[0]?.id, 'chat-config')
})
