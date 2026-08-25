import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import * as slots from './index.ts'

const Dummy = () => null

async function boot() {
  const ctx = new Context()
  await ctx.plugin(slots)
  return ctx
}

test('undeclared fill throws', async () => {
  const ctx = await boot()
  assert.throws(() => ctx.slots.fill('stage', Dummy))
})

test('place waits for open; close clears fills', async () => {
  const ctx = await boot()
  ctx.slots.place('stage', Dummy, { key: 'c' })
  assert.equal(ctx.slots.list('stage').length, 0)
  const shell = await ctx.plugin({
    inject: ['slots'],
    apply: (c: Context) => c.slots.fill('root', Dummy, { children: { stage: { kind: 'list' } } }),
  })
  assert.equal(ctx.slots.list('stage').length, 1)
  await shell.dispose()
  assert.equal(ctx.slots.specOf('stage'), undefined)
  assert.equal(ctx.slots.list('stage').length, 0)
})

test('duplicate key throws', async () => {
  const ctx = await boot()
  ctx.slots.fill('root', Dummy, { children: { stage: { kind: 'list' } } })
  ctx.slots.fill('stage', Dummy, { key: 'c' })
  assert.throws(() => ctx.slots.fill('stage', Dummy, { key: 'c' }))
})
