import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import * as slots from '@biu/web-slots'
import * as appModules from '@biu/web-app-modules'
import * as snapshot from '@biu/web-snapshot'
import * as sessionView from '@biu/web-session-view'
import * as projectView from '@biu/web-project-view'
import * as uiHub from './index.ts'
import { uiPackageLoaders } from 'virtual:cordis-ui-loaders'

const Dummy = () => null

function plugin(id: string, enabled: boolean, web?: string) {
  return {
    id,
    name: id,
    layer: 'capability',
    blurb: '',
    inject: [] as string[],
    togglable: true,
    enabled,
    state: enabled ? 'active' : 'off',
    ...(web ? { web } : {}),
  }
}

test('ui-hub mounts configured ui packages including chat', async () => {
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
  const clockUi = uiIds.find((id) => id.includes('cap-clock/web'))
  assert.ok(clockUi, 'clock-web loader missing')
  const chatUi = uiIds.find((id) => id === '@biu/cap-chat/web' || id.includes('cap-chat/web'))
  assert.ok(chatUi, `chat-ui loader missing in ${uiIds.join(',')}`)
  const base = ctx.snapshot.get()
  ctx.snapshot.get = () => ({
    ...base,
    plugins: [plugin('clock', true, clockUi), plugin('chat', true, chatUi)],
  })
  await ctx.plugin(uiHub)
  const deadline = Date.now() + 5000
  while (Date.now() < deadline && ctx.slots.list('composer').every((item) => item.id !== 'chat')) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert.equal(ctx.slots.list('demos').length >= 1, true)
  assert.equal(ctx.slots.list('composer').some((item) => item.id === 'chat'), true)
  assert.equal(ctx.slots.list('models').some((item) => item.id === 'chat-config'), true)
})
