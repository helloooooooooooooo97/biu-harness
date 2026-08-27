import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import * as slots from '@biu/web-slots'
import * as appModules from '@biu/web-app-modules'
import * as storeUi from './index.tsx'

test('plugin store registers the plugins activity module', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(appModules)
  ctx.slots.fill('root', () => null, {
    children: {
      'app-modules': { kind: 'list' },
    },
  })
  await ctx.plugin(storeUi)
  const mods = ctx.appModules.list()
  assert.equal(mods.some((item) => item.id === 'plugins' && item.path === '/plugins'), true)
  assert.equal(ctx.slots.list('app-modules').some((item) => item.id === 'plugin-store-module'), true)
  assert.ok(ctx.slots.specOf('plugin-store-extras'))
})
