import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../../types.ts'
import * as slots from '../../registry/slots.ts'
import * as appModules from '../../infrastructure/app-modules.ts'
import * as snapshot from '../../infrastructure/snapshot.ts'
import * as sessionView from '../../infrastructure/session-view.ts'
import * as projectView from '../../infrastructure/project-view.ts'
import * as chat from './index.ts'
import * as shell from '../shell.tsx'

test('one plugin fills thread, trajectory, composer, approvals dock and models', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(appModules)
  await ctx.plugin(sessionView)
  await ctx.plugin(projectView)
  await ctx.plugin(snapshot)
  await ctx.plugin(chat)
  assert.equal(ctx.slots.list('composer').length, 0)
  await ctx.plugin(shell)
  assert.equal(ctx.slots.list('composer')[0]?.id, 'chat')
  assert.equal(ctx.slots.list('stage').some((item) => item.id === 'chat-thread'), true)
  assert.equal(ctx.slots.list('trajectory').some((item) => item.id === 'trajectory'), true)
  assert.equal(ctx.slots.list('project').length, 0)
  assert.equal(ctx.slots.list('dock').some((item) => item.id === 'approvals'), true)
  assert.equal(ctx.slots.list('models')[0]?.id, 'chat-config')
})
