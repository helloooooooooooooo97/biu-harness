import assert from 'node:assert/strict'
import { test } from 'vitest'
import { Context } from 'cordis'
import * as sessionStore from '@biu/host-session-store'
import * as sessions from './index.ts'
import { SESSION_FORMAT_VERSION } from './index.ts'
import { mascotFromSessionId } from './session-mascot.ts'
import { nameFromSessionMascot } from '@biu/type-session'

test('create persists mascot on the session record', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  const record = await ctx.sessions.create()
  assert.ok(record.mascot)
  assert.equal(typeof record.mascot!.shape, 'string')
  assert.equal(typeof record.mascot!.color, 'string')

  const again = await ctx.sessions.require(record.id)
  assert.deepEqual(again.mascot, record.mascot)

  const listed = await ctx.sessions.listSummaries()
  const item = listed.find((row) => row.id === record.id)
  assert.deepEqual(item?.mascot, record.mascot)
  assert.equal(item?.title, nameFromSessionMascot(record.mascot!))
  assert.match(item?.title ?? '', /^[墨栗赤橙金翠青蓝紫玫灰]/)
  assert.notEqual(item?.title, record.id.slice(0, 8))
})

test('legacy sessions get a stable backfilled mascot', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  const bare = {
    id: crypto.randomUUID(),
    version: SESSION_FORMAT_VERSION,
    events: [{ type: 'session/open' as const, version: SESSION_FORMAT_VERSION, seq: 0, ts: Date.now() }],
  }
  await ctx.sessionStore.save(bare)
  const expected = mascotFromSessionId(bare.id)
  const listed = await ctx.sessions.listSummaries()
  const item = listed.find((row) => row.id === bare.id)
  assert.deepEqual(item?.mascot, expected)
  assert.equal(item?.title, nameFromSessionMascot(expected))
  const loaded = await ctx.sessions.require(bare.id)
  assert.deepEqual(loaded.mascot, expected)
})

test('fork assigns a persisted mascot', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  const parent = await ctx.sessions.create()
  const child = await ctx.sessions.fork(parent.id)
  assert.ok(child.mascot)
  const loaded = await ctx.sessions.require(child.id)
  assert.deepEqual(loaded.mascot, child.mascot)
})
