import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import * as slots from '@biu/web-slots'
import * as appModules from '@biu/web-app-modules'
import * as snapshot from '@biu/web-snapshot'
import * as sessionView from '@biu/web-session-view'
import * as projectView from '@biu/web-project-view'
import * as shell from './index.tsx'

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
  assert.equal(ctx.slots.specOf('header-tools')?.kind, 'list')
  assert.equal(ctx.slots.specOf('root-overlays')?.kind, 'list')
  assert.equal(ctx.slots.specOf('tasks'), undefined)
  assert.equal(ctx.slots.specOf('channels'), undefined)
  assert.equal(ctx.slots.specOf('dashboard'), undefined)
  assert.equal(ctx.slots.list('root').length, 1)
  const addView = ctx.slots.list('inspector-panels').find((item) => item.id === 'common-add-view')
  assert.equal(addView?.props?.().common, true)
  assert.equal(addView?.props?.().action, 'add-view')
  assert.equal(addView?.props?.().tabLabel, '添加视图')
})
