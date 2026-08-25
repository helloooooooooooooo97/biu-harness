import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import * as slots from '@biu/web-slots'
import * as appModules from '@biu/web-app-modules'
import * as snapshot from '@biu/web-snapshot'
import * as sessionView from '@biu/web-session-view'
import * as projectView from '@biu/web-project-view'
import * as nav from './nav.tsx'
import * as shell from './index.tsx'

test('fills sidebar', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(appModules)
  await ctx.plugin(sessionView)
  await ctx.plugin(projectView)
  await ctx.plugin(snapshot)
  await ctx.plugin(nav)
  await ctx.plugin(shell)
  assert.equal(ctx.slots.list('sidebar')[0]?.id, 'nav')
})
