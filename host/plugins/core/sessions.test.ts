import { mkdtemp, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as sessionStore from '../storage/session-store.ts'
import * as sessions from './sessions.ts'
import { SESSION_FORMAT_VERSION, deriveMessages, applyContextBudget, estimateTokens } from './sessions.ts'

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
    { role: 'assistant', content: 'yo' },
  ])
})

test('tool_calls assistant uses null content for API history', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  const record = await ctx.sessions.create()
  await ctx.sessions.append(record.id, { type: 'user/message', text: 'run', kind: 'wake' })
  await ctx.sessions.append(record.id, {
    type: 'assistant/message',
    text: '',
    tool_calls: [{ id: '1', name: 'clock_now', arguments: '{}' }],
  })
  await ctx.sessions.append(record.id, { type: 'tool/result', id: '1', name: 'clock_now', ok: true, detail: 'now' })
  assert.deepEqual(deriveMessages((await ctx.sessions.require(record.id)).events), [
    { role: 'user', content: 'run' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: '1', type: 'function', function: { name: 'clock_now', arguments: '{}' } }],
    },
    { role: 'tool', tool_call_id: '1', content: 'now' },
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

test('sqlite session store round-trips and listSummaries skips full reload', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cordis-sqlite-'))
  const path = join(dir, 'sessions.sqlite')
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'sqlite', path, dir: join(dir, 'json') })
  await ctx.plugin(sessions)
  const record = await ctx.sessions.create('sql1')
  await ctx.sessions.append('sql1', { type: 'user/message', text: 'sqlite hi', kind: 'wake' })
  await ctx.sessions.append('sql1', { type: 'assistant/message', text: 'ok' })
  await ctx.sessions.append('sql1', { type: 'turn/end', turn: 1, reason: 'complete' })
  const summaries = await ctx.sessions.listSummaries()
  assert.equal(summaries[0]?.id, 'sql1')
  assert.equal(summaries[0]?.title, 'sqlite hi')
  assert.equal(summaries[0]?.eventCount, 4)

  const ctx2 = new Context()
  await ctx2.plugin(sessionStore, { driver: 'sqlite', path, dir: join(dir, 'json') })
  await ctx2.plugin(sessions)
  const loaded = await ctx2.sessions.get('sql1')
  assert.equal(loaded?.id, record.id)
  assert.equal(loaded?.events.length, 4)
  assert.equal(loaded?.events.some((item) => item.type === 'assistant/message' && item.text === 'ok'), true)
})

test('reload heals open step/turn left by crash', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cordis-heal-'))
  const path = join(dir, 'sessions.sqlite')
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'sqlite', path, dir: join(dir, 'json') })
  await ctx.plugin(sessions)
  await ctx.sessions.create('heal1')
  await ctx.sessions.append('heal1', { type: 'user/message', text: 'go', kind: 'wake' })
  await ctx.sessions.append('heal1', { type: 'turn/start', turn: 1 })
  await ctx.sessions.append('heal1', { type: 'step/start', turn: 1, step: 0 })
  // simulate crash: no step/end, no turn/end

  const ctx2 = new Context()
  await ctx2.plugin(sessionStore, { driver: 'sqlite', path, dir: join(dir, 'json') })
  await ctx2.plugin(sessions)
  const loaded = await ctx2.sessions.get('heal1')
  assert.ok(loaded)
  const types = loaded!.events.map((item) => item.type)
  assert.equal(types.includes('step/end'), true)
  assert.equal(types.at(-1), 'turn/end')
  const end = loaded!.events.at(-1)
  assert.equal(end?.type, 'turn/end')
  if (end?.type === 'turn/end') {
    assert.equal(end.reason, 'host-restart')
    assert.equal(end.turn, 1)
  }
  // second get should not append again
  const again = await ctx2.sessions.get('heal1')
  assert.equal(again?.events.length, loaded!.events.length)

  const ctx3 = new Context()
  await ctx3.plugin(sessionStore, { driver: 'sqlite', path, dir: join(dir, 'json') })
  await ctx3.plugin(sessions)
  const persisted = await ctx3.sessions.get('heal1')
  assert.equal(persisted?.events.filter((item) => item.type === 'turn/end').length, 1)
  assert.equal(persisted?.events.filter((item) => item.type === 'step/end').length, 1)
})

test('reload heals orphan tool_calls so next LLM round is valid', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cordis-heal-tools-'))
  const path = join(dir, 'sessions.sqlite')
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'sqlite', path, dir: join(dir, 'json') })
  await ctx.plugin(sessions)
  await ctx.sessions.create('heal-tools')
  await ctx.sessions.append('heal-tools', { type: 'user/message', text: 'wake workers', kind: 'wake' })
  await ctx.sessions.append('heal-tools', { type: 'turn/start', turn: 1 })
  await ctx.sessions.append('heal-tools', { type: 'step/start', turn: 1, step: 0 })
  await ctx.sessions.append('heal-tools', {
    type: 'assistant/message',
    text: '',
    tool_calls: [{ id: 'call_1', name: 'session_wake', arguments: '{"text":"hi"}' }],
  })
  // crash before tool/result

  const ctx2 = new Context()
  await ctx2.plugin(sessionStore, { driver: 'sqlite', path, dir: join(dir, 'json') })
  await ctx2.plugin(sessions)
  const loaded = await ctx2.sessions.get('heal-tools')
  assert.ok(loaded)
  const result = loaded!.events.find((item) => item.type === 'tool/result')
  assert.equal(result?.type, 'tool/result')
  if (result?.type === 'tool/result') {
    assert.equal(result.id, 'call_1')
    assert.equal(result.ok, false)
  }
  const history = ctx2.sessions.deriveMessages('heal-tools')
  const assistant = history.find((item) => item.role === 'assistant' && item.tool_calls?.length)
  const tool = history.find((item) => item.role === 'tool' && item.tool_call_id === 'call_1')
  assert.ok(assistant)
  assert.ok(tool)
})

test('sqlite migrates legacy json sessions once', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cordis-migrate-'))
  const jsonDir = join(dir, 'sessions')
  const path = join(dir, 'sessions.sqlite')
  const ctxJson = new Context()
  await ctxJson.plugin(sessionStore, { driver: 'json', dir: jsonDir })
  await ctxJson.plugin(sessions)
  await ctxJson.sessions.create('legacy1')
  await ctxJson.sessions.append('legacy1', { type: 'user/message', text: 'from json', kind: 'wake' })

  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'sqlite', path, dir: jsonDir })
  await ctx.plugin(sessions)
  const loaded = await ctx.sessions.get('legacy1')
  assert.equal(loaded?.events.some((item) => item.type === 'user/message' && item.text === 'from json'), true)
})

test('fork copies the append-only log into a child session', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  const parent = await ctx.sessions.create()
  await ctx.sessions.append(parent.id, { type: 'user/message', text: 'keep', kind: 'wake' })
  const child = await ctx.sessions.fork(parent.id)
  assert.notEqual(child.id, parent.id)
  assert.equal(ctx.sessions.deriveMessages(child.id).some((item) => item.content === 'keep'), true)
  await ctx.sessions.append(child.id, { type: 'assistant/message', text: 'child-only' })
  assert.equal((await ctx.sessions.require(parent.id)).events.some((item) => item.type === 'assistant/message'), false)
})

test('setProject binds host absolute path and clears it', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  const record = await ctx.sessions.create()
  const dir = await mkdtemp(join(tmpdir(), 'cordis-proj-'))
  const project = await ctx.sessions.setProject(record.id, { path: dir })
  assert.equal(project?.name, basename(dir))
  assert.equal(project?.path, await realpath(dir))
  assert.equal((await ctx.sessions.require(record.id)).project?.path, project?.path)
  const child = await ctx.sessions.fork(record.id)
  assert.equal(child.project?.path, project?.path)
  assert.equal(await ctx.sessions.setProject(record.id, null), undefined)
  assert.equal((await ctx.sessions.require(record.id)).project, undefined)
})

test('delete removes session from store and cache', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  const record = await ctx.sessions.create()
  assert.equal(await ctx.sessions.delete(record.id), true)
  assert.equal(await ctx.sessions.get(record.id), undefined)
  assert.equal((await ctx.sessions.list()).includes(record.id), false)
  assert.equal(await ctx.sessions.delete(record.id), false)
})

test('create/listSummaries/fork preserve session type', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  const chat = await ctx.sessions.create()
  const live = await ctx.sessions.create(undefined, { type: 'live' })
  assert.equal(chat.type, 'chat')
  assert.equal(live.type, 'live')
  const summaries = await ctx.sessions.listSummaries()
  assert.equal(summaries.find((item) => item.id === live.id)?.type, 'live')
  assert.equal(summaries.find((item) => item.id === chat.id)?.type, 'chat')
  const forked = await ctx.sessions.fork(live.id)
  assert.equal(forked.type, 'live')
})

test('sqlite persists session type across reopen', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cordis-type-'))
  const path = join(dir, 'sessions.sqlite')
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'sqlite', path, dir: join(dir, 'json') })
  await ctx.plugin(sessions)
  await ctx.sessions.create('live-sql', { type: 'live' })
  const ctx2 = new Context()
  await ctx2.plugin(sessionStore, { driver: 'sqlite', path, dir: join(dir, 'json') })
  await ctx2.plugin(sessions)
  const loaded = await ctx2.sessions.get('live-sql')
  assert.equal(loaded?.type, 'live')
  assert.equal((await ctx2.sessions.listSummaries())[0]?.type, 'live')
})


test('estimateTokens approximates ascii and cjk', () => {
  // 英文 ~1/4 字符；800 英文 → ~200 token
  const ascii = estimateTokens('a'.repeat(800))
  assert.ok(ascii >= 150 && ascii <= 250, `ascii tokens=${ascii}`)
  // 中文 ~1/1.5 字符；150 中文 → ~100 token
  const cjk = estimateTokens('测'.repeat(150))
  assert.ok(cjk >= 70 && cjk <= 130, `cjk tokens=${cjk}`)
})

test('applyContextBudget: within budget returns unchanged (cache-friendly)', () => {
  const msgs: LlmMessage[] = [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'hello'.repeat(100) },
    { role: 'assistant', content: 'hi' },
  ]
  const out = applyContextBudget(msgs, 1_000_000)
  assert.equal(out, msgs) // 引用相同 → 原样返回
})

test('applyContextBudget: over budget keeps head + recent tail', () => {
  const mk = (i: number): LlmMessage => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: ('block-' + i).padEnd(400, 'x') })
  const msgs: LlmMessage[] = [{ role: 'system', content: 'SYS' }, ...Array.from({ length: 20 }, (_, i) => mk(i))]
  const out = applyContextBudget(msgs, 100, 4)
  // 保留 system + 最近 4 条，其余丢弃
  assert.equal(out[0]?.role, 'system')
  assert.ok(out.length <= 5)
  assert.equal(out[out.length - 1], msgs[msgs.length - 1]) // 最新保留
  // 中间的旧消息被丢弃
  assert.ok(out.length < msgs.length)
})

test('deriveMessages honors context_compact_submit tool/call as new prefix', () => {
  const events: SessionEvent[] = [
    { type: 'session/open', version: 1, seq: 0, ts: 0 },
    { type: 'system/prompt', text: 'SYS', seq: 1, ts: 1 },
    { type: 'user/message', text: '旧的早期消息A', kind: 'normal', seq: 2, ts: 2 },
    { type: 'assistant/message', text: '早期回答B', seq: 3, ts: 3 },
    { type: 'tool/call', id: 't1', name: 'context_compact_submit', arguments: JSON.stringify({ text: '摘要：聊了早期内容' }), seq: 4, ts: 4 },
    { type: 'user/message', text: '压缩后的新问题', kind: 'normal', seq: 5, ts: 5 },
  ]
  const out = deriveMessages(events as any)
  const joined = out.map((m) => typeof m.content === 'string' ? m.content : '').join('|')
  // 压缩点后的新对话保留；摘要作为前缀；旧历史不重复出现
  assert.ok(joined.includes('压缩后的新问题'))
  assert.ok(joined.includes('摘要：聊了早期内容'))
  assert.ok(!joined.includes('旧早期消息A'))
  assert.ok(!joined.includes('早期回答B'))
})
