import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as slots from '../registry/slots.ts'
import * as appModules from '../infrastructure/app-modules.ts'
import * as snapshot from '../infrastructure/snapshot.ts'
import * as sessionView from '../infrastructure/session-view.ts'
import * as projectView from '../infrastructure/project-view.ts'
import * as shell from './shell.tsx'

test('declares generic module slots, not plugin ids', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(appModules)
  await ctx.plugin(sessionView)
  await ctx.plugin(projectView)
  await ctx.plugin(snapshot)
  await ctx.plugin(shell)
  assert.equal(ctx.slots.specOf('sidebar')?.kind, 'single')
  assert.equal(ctx.slots.specOf('demos')?.kind, 'list')
  assert.equal(ctx.slots.specOf('app-modules')?.kind, 'list')
  assert.equal(ctx.slots.specOf('inspector-panels')?.kind, 'list')
  assert.equal(ctx.slots.specOf('tasks'), undefined)
  assert.equal(ctx.slots.specOf('channels'), undefined)
  assert.equal(ctx.slots.specOf('dashboard'), undefined)
  assert.equal(ctx.slots.list('root').length, 1)
})
