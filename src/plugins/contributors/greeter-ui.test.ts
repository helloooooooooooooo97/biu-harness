import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as slots from '../registry/slots.ts'
import * as snapshot from '../infrastructure/snapshot.ts'
import * as sessionView from '../infrastructure/session-view.ts'
import * as projectView from '../infrastructure/project-view.ts'
import * as greeterUi from '@hmr/greeter-ui'
import * as shell from './shell.tsx'

test('greeter-ui fills demos after shell opens it', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(sessionView)
  await ctx.plugin(projectView)
  await ctx.plugin(snapshot)
  await ctx.plugin(greeterUi)
  assert.equal(ctx.slots.list('demos').length, 0)
  await ctx.plugin(shell)
  assert.equal(ctx.slots.list('demos')[0]?.id, 'hello')
})
