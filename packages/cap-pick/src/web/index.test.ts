import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import * as slots from '@biu/web-slots'
import * as dock from '@biu/core-dock'
import * as pickUi from './index.tsx'

test('places overlay and a dock pick tile, not a header toggle', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(dock)
  ctx.slots.fill('root', () => null, {
    children: {
      'header-tools': { kind: 'list' },
      'root-overlays': { kind: 'list' },
    },
  })
  await ctx.plugin(pickUi)
  assert.ok(ctx.pick)
  assert.equal(ctx.slots.list('header-tools').some((item) => item.id === 'pick-toggle'), false)
  assert.equal(ctx.slots.list('root-overlays').some((item) => item.id === 'pick-overlay'), true)
  assert.equal(ctx.dock.list().some((item) => item.id === 'pick'), true)
})
