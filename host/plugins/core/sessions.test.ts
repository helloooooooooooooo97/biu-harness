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
