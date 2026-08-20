import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as sessionStore from '../storage/session-store.ts'
import * as sessions from './sessions.ts'
import { SESSION_FORMAT_VERSION, deriveMessages } from './sessions.ts'

test('append-only log projects model history; version is 1', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  const record = await ctx.sessions.create()
  assert.equal(record.version, SESSION_FORMAT_VERSION)
  await ctx.sessions.append(record.id, { type: 'system/prompt', text: 'sys' })
  await ctx.sessions.append(record.id, { type: 'user/message', text: 'hi', kind: 'wake' })
  await ctx.sessions.append(record.id, { type: 'assistant/message', text: 'yo' })
  assert.deepEqual(deriveMessages((await ctx.sessions.require(record.id)).events), [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'yo', tool_calls: undefined },
  ])
})

test('json session store round-trips versioned records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cordis-sess-'))
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'json', dir })
  await ctx.plugin(sessions)
  const record = await ctx.sessions.create('s1')
  await ctx.sessions.append('s1', { type: 'user/message', text: 'hi', kind: 'wake' })
  const ctx2 = new Context()
  await ctx2.plugin(sessionStore, { driver: 'json', dir })
  await ctx2.plugin(sessions)
  const loaded = await ctx2.sessions.get('s1')
  assert.equal(loaded?.version, SESSION_FORMAT_VERSION)
  assert.equal(loaded?.id, record.id)
  assert.equal(loaded?.events.some((item) => item.type === 'user/message'), true)
})
