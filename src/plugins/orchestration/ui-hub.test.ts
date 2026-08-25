import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as slots from '../registry/slots.ts'
import * as appModules from '../infrastructure/app-modules.ts'
import * as snapshot from '../infrastructure/snapshot.ts'
import * as sessionView from '../infrastructure/session-view.ts'
import * as projectView from '../infrastructure/project-view.ts'
import * as uiHub from './ui-hub.ts'
import { uiPackageLoaders } from 'virtual:cordis-ui-loaders'

const Dummy = () => null

function plugin(id: string, enabled: boolean, ui?: string) {
  return {
    id,
    name: id,
    layer: 'capability',
    blurb: '',
    inject: [] as string[],
    togglable: true,
    enabled,
    state: enabled ? 'active' : 'off',
    ...(ui ? { ui } : {}),
  }
}

test('ui-hub mounts configured ui packages and builtin chat', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(appModules)
  await ctx.plugin(sessionView)
  await ctx.plugin(projectView)
  await ctx.plugin(snapshot)
  ctx.slots.fill('root', Dummy, {
    children: {
      stage: { kind: 'list' },
      demos: { kind: 'list' },
      dock: { kind: 'list' },
      project: { kind: 'single' },
      composer: { kind: 'single' },
      models: { kind: 'single' },
      settings: { kind: 'list' },
      'app-modules': { kind: 'list' },
      'inspector-panels': { kind: 'list' },
    },
  })
  const uiIds = Object.keys(uiPackageLoaders)
  assert.ok(uiIds.length >= 1, 'virtual loaders should come from cordis.plugins.json')
  const greeterUi = uiIds.find((id) => id.includes('greeter'))
  assert.ok(greeterUi, 'greeter-ui loader missing')
  const base = ctx.snapshot.get()
  ctx.snapshot.get = () => ({
    ...base,
    plugins: [plugin('greeter', true, greeterUi), plugin('chat', true)],
  })
  await ctx.plugin(uiHub)
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert.equal(ctx.slots.list('demos').length >= 1, true)
  assert.equal(ctx.slots.list('composer').some((item) => item.id === 'chat'), true)
  assert.equal(ctx.slots.list('models').some((item) => item.id === 'chat-config'), true)
})
