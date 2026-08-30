import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import * as slots from '@biu/web-slots'
import * as pickUi from './index.tsx'

test('places header toggle and overlay into generic slots', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  ctx.slots.fill('root', () => null, {
    children: {
      'corner-tools': { kind: 'list' },
      'root-overlays': { kind: 'list' },
    },
  })
  await ctx.plugin(pickUi)
  assert.ok(ctx.pick)
  assert.equal(ctx.slots.list('corner-tools').some((item) => item.id === 'pick-toggle'), true)
  assert.equal(ctx.slots.list('root-overlays').some((item) => item.id === 'pick-overlay'), true)
})
