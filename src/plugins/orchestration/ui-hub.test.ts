import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as slots from '../registry/slots.ts'
import * as snapshot from '../infrastructure/snapshot.ts'
import * as sessionView from '../infrastructure/session-view.ts'
import * as projectView from '../infrastructure/project-view.ts'
import * as uiHub from './ui-hub.ts'

const Dummy = () => null

function plugin(id: string, enabled: boolean) {
  return {
    id,
    name: id,
    layer: 'capability',
    blurb: '',
    inject: [],
    togglable: true,
    enabled,
    state: enabled ? 'active' : 'off',
  }
}

test('ui-hub mounts hello and chat from snapshot', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
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
      settings: { kind: 'list' },
    },
  })
  const base = ctx.snapshot.get()
  ctx.snapshot.get = () => ({
    ...base,
    plugins: [plugin('greeter', true), plugin('chat', true)],
  })
  await ctx.plugin(uiHub)
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(ctx.slots.list('demos').some((item) => item.id === 'hello'), true)
  assert.equal(ctx.slots.list('composer').some((item) => item.id === 'chat'), true)
  assert.equal(ctx.slots.list('settings').some((item) => item.id === 'chat-config'), true)
})
