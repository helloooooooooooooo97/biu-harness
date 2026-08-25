import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import './types.ts'
import * as slots from '@biu/web-slots'

test('ctx.slots is provided', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  assert.equal(typeof ctx.slots.fill, 'function')
})
