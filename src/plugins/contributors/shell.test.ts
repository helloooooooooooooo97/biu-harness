import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as slots from '../registry/slots.ts'
import * as snapshot from '../infrastructure/snapshot.ts'
import * as sessionView from '../infrastructure/session-view.ts'
import * as projectView from '../infrastructure/project-view.ts'
import * as shell from './shell.tsx'

test('declares dsh-like sidebar, demos, dock, stage, trajectory, project, composer', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(sessionView)
  await ctx.plugin(projectView)
  await ctx.plugin(snapshot)
  await ctx.plugin(shell)
  assert.equal(ctx.slots.specOf('sidebar')?.kind, 'single')
  assert.equal(ctx.slots.specOf('demos')?.kind, 'list')
  assert.equal(ctx.slots.specOf('dock')?.kind, 'list')
  assert.equal(ctx.slots.specOf('stage')?.kind, 'list')
  assert.equal(ctx.slots.specOf('trajectory')?.kind, 'list')
  assert.equal(ctx.slots.specOf('project')?.kind, 'single')
  assert.equal(ctx.slots.specOf('composer')?.kind, 'single')
  assert.equal(ctx.slots.specOf('settings')?.kind, 'list')
  assert.equal(ctx.slots.specOf('log')?.kind, 'single')
  assert.equal(ctx.slots.specOf('tasks')?.kind, 'single')
  assert.equal(ctx.slots.specOf('inspector-tasks')?.kind, 'single')
  assert.equal(ctx.slots.list('root').length, 1)
})
