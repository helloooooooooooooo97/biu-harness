import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from 'cordis'
import * as sessionStore from '@biu/host-session-store'
import * as sessions from '@biu/host-sessions'
import * as tools from '@biu/host-tools'
import * as systemPrompt from '@biu/host-system-prompt'
import * as llm from '@biu/host-llm'
import * as agentLoop from '@biu/host-agent-loop'
import * as agents from '@biu/host-agents'
import * as liveSessions from './index.ts'
import { runWithSession } from '@biu/host-sessions/scope'

test('live tools list/inspect/inject; reject from chat sessions', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(llm)
  await ctx.plugin(agentLoop)
  await ctx.plugin(agents)
  await ctx.plugin(liveSessions)

  const live = await ctx.sessions.create(undefined, { type: 'live' })
  const chat = await ctx.sessions.create()
  await ctx.sessions.append(chat.id, { type: 'user/message', text: 'hello worker', kind: 'wake' })

  await assert.rejects(
    () =>
      runWithSession(chat.id, () =>
        ctx.tools.invoke('session_list', {}, new AbortController().signal),
      ),
    /only available in live/,
  )

  const listed = (await runWithSession(live.id, () =>
    ctx.tools.invoke('session_list', { type: 'chat' }, new AbortController().signal),
  )) as { sessions: Array<{ id: string; type: string; self?: boolean }> }
  assert.equal(listed.sessions.some((item) => item.id === chat.id), true)
  assert.equal(listed.sessions.some((item) => item.id === live.id), false)

  const listedAll = (await runWithSession(live.id, () =>
    ctx.tools.invoke('session_list', {}, new AbortController().signal),
  )) as { sessions: Array<{ id: string; self?: boolean }> }
  const selfRow = listedAll.sessions.find((item) => item.id === live.id)
  assert.ok(selfRow)
  assert.equal(selfRow?.self, true)
  assert.equal(listedAll.sessions.find((item) => item.id === chat.id)?.self, false)

  const inspected = (await runWithSession(live.id, () =>
    ctx.tools.invoke('session_inspect', { sessionId: chat.id }, new AbortController().signal),
  )) as { recent: Array<{ text: string }> }
  assert.equal(inspected.recent.some((item) => item.text.includes('hello worker')), true)

  const injected = (await runWithSession(live.id, () =>
    ctx.tools.invoke(
      'session_inject',
      { sessionId: chat.id, text: 'keep going' },
      new AbortController().signal,
    ),
  )) as { queued: boolean }
  assert.equal(injected.queued, true)
})

test('live session turn unlocks session_* tools on top of minimal mode', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(llm)
  await ctx.plugin(agentLoop)
  await ctx.plugin(agents)
  await ctx.plugin(liveSessions)

  // 模拟极简底座已有 bash；live 工具应作为增量挂上
  ctx.tools.register({
    name: 'bash',
    description: 'bash',
    parameters: { type: 'object', properties: {} },
    execute: () => 'ok',
  })
  ctx.tools.setMode('minimal')
  assert.deepEqual(ctx.tools.names().sort(), ['bash'])
  assert.equal(ctx.tools.names().includes('session_list'), false)

  const live = await ctx.sessions.create(undefined, { type: 'live' })
  let seen: string[] = []
  const { AgentLoop } = await import('@biu/host-agent-loop')
  const loop = new AgentLoop(
    ctx,
    {
      async chat(_messages, toolSchemas) {
        seen = (toolSchemas as Array<{ function: { name: string } }>).map((item) => item.function.name).sort()
        return { content: 'ok', toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 } }
      },
    },
    live.id,
    new AbortController().signal,
  )
  await loop.run([{ kind: 'wake', text: 'list sessions' }])
  assert.equal(seen.includes('bash'), true)
  for (const name of liveSessions.LIVE_TOOL_NAMES) {
    assert.equal(seen.includes(name), true, `expected ${name} in schemas during live turn`)
  }
  // 回合外仍回到极简底座
  assert.deepEqual(ctx.tools.names().sort(), ['bash'])
})

test('buildSessionProgress derives turn/step/status and afterSeq delta text', () => {
  const events = [
    { type: 'session/open' as const, version: 1, seq: 0, ts: 1 },
    { type: 'turn/start' as const, turn: 1, seq: 1, ts: 2 },
    { type: 'step/start' as const, turn: 1, step: 1, seq: 2, ts: 3 },
    { type: 'tool/call' as const, id: '1', name: 'bash', arguments: '{}', seq: 3, ts: 4 },
    { type: 'tool/result' as const, id: '1', name: 'bash', ok: true, detail: 'ok', seq: 4, ts: 5 },
    { type: 'assistant/message' as const, text: 'working on it', seq: 5, ts: 6 },
    { type: 'step/end' as const, turn: 1, step: 1, seq: 6, ts: 7 },
  ]
  const mid = liveSessions.buildSessionProgress(events, { busy: true })
  assert.equal(mid.status, 'running')
  assert.equal(mid.turn, 1)
  assert.equal(mid.step, 1)
  assert.equal(mid.lastTool?.name, 'bash')
  assert.equal(mid.lastTool?.ok, true)
  assert.equal(mid.assistantText, 'working on it')

  const more = [
    ...events,
    { type: 'assistant/message' as const, text: 'almost done', seq: 7, ts: 8 },
    { type: 'turn/end' as const, turn: 1, reason: 'complete', seq: 8, ts: 9 },
  ]
  const done = liveSessions.buildSessionProgress(more, { afterSeq: 6, busy: false })
  assert.equal(done.status, 'idle')
  assert.equal(done.reason, 'complete')
  assert.equal(done.assistantText, 'almost done')
  assert.equal(done.newestSeq, 8)
})

test('session_progress and async wake work for live caller', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(llm)
  await ctx.plugin(agentLoop)
  await ctx.plugin(agents)
  await ctx.plugin(liveSessions)

  const live = await ctx.sessions.create(undefined, { type: 'live' })
  const chat = await ctx.sessions.create()
  await ctx.sessions.append(chat.id, { type: 'turn/start', turn: 1 })
  await ctx.sessions.append(chat.id, { type: 'step/start', turn: 1, step: 2 })
  await ctx.sessions.append(chat.id, { type: 'assistant/message', text: 'halfway' })

  const progress = (await runWithSession(live.id, () =>
    ctx.tools.invoke('session_progress', { sessionId: chat.id }, new AbortController().signal),
  )) as { status: string; step: number; assistantText: string }
  assert.equal(progress.status, 'running')
  assert.equal(progress.step, 2)
  assert.equal(progress.assistantText, 'halfway')

  const listed = (await runWithSession(live.id, () =>
    ctx.tools.invoke('session_list', {}, new AbortController().signal),
  )) as { sessions: Array<{ id: string; status: string }> }
  assert.equal(listed.sessions.find((item) => item.id === chat.id)?.status, 'idle')
})

test('wait=false wake: queues worker and does not append note to live', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(llm)
  await ctx.plugin(agentLoop)
  await ctx.plugin(agents)
  await ctx.plugin(liveSessions)

  let workerFinished = false
  ctx.agentLoop.setFactory((_llm, sessionId) => ({
    run: async () => {
      await ctx.sessions.append(sessionId, { type: 'turn/start', turn: 1 })
      await ctx.sessions.append(sessionId, { type: 'assistant/message', text: 'task done' })
      await ctx.sessions.append(sessionId, { type: 'turn/end', turn: 1, reason: 'complete' })
      workerFinished = true
      return { text: 'task done', steps: [] }
    },
  }))
  ctx.agents.configure({ provider: 'deepseek', apiKey: '', model: 'x' })

  const live = await ctx.sessions.create(undefined, { type: 'live' })
  const chat = await ctx.sessions.create()
  const liveEventCountBefore = (await ctx.sessions.require(live.id)).events.length

  const result = (await runWithSession(live.id, () =>
    ctx.tools.invoke(
      'session_wake',
      { sessionId: chat.id, text: 'go', wait: false },
      new AbortController().signal,
    ),
  )) as { queued: boolean; wait: boolean }

  assert.equal(result.queued, true)
  assert.equal(result.wait, false)

  for (let i = 0; i < 40; i += 1) {
    if (workerFinished) break
    await new Promise((r) => setTimeout(r, 25))
  }
  assert.equal(workerFinished, true)

  const liveEvents = (await ctx.sessions.require(live.id)).events
  assert.equal(liveEvents.length, liveEventCountBefore)
  assert.equal(
    liveEvents.some(
      (item) => item.type === 'assistant/message' && item.text.includes('[指挥席]'),
    ),
    false,
  )
})

test('session_create / session_configure bind and rebind project folder', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(llm)
  await ctx.plugin(agentLoop)
  await ctx.plugin(agents)
  await ctx.plugin(liveSessions)

  const live = await ctx.sessions.create(undefined, { type: 'live' })
  const dirA = await mkdtemp(join(tmpdir(), 'proj-a-'))
  const dirB = await mkdtemp(join(tmpdir(), 'proj-b-'))
  try {
    const created = (await runWithSession(live.id, () =>
      ctx.tools.invoke(
        'session_create',
        { title: 'worker-folder', project: dirA },
        new AbortController().signal,
      ),
    )) as { id: string; project: { path: string; name: string } | null }
    assert.ok(created.id)
    assert.equal(created.project?.path, dirA)

    const configured = (await runWithSession(live.id, () =>
      ctx.tools.invoke(
        'session_configure',
        { sessionId: created.id, project: dirB },
        new AbortController().signal,
      ),
    )) as { project: { path: string } | null }
    assert.equal(configured.project?.path, dirB)

    const cleared = (await runWithSession(live.id, () =>
      ctx.tools.invoke(
        'session_configure',
        { sessionId: created.id, project: '' },
        new AbortController().signal,
      ),
    )) as { project: unknown }
    assert.equal(cleared.project, null)
  } finally {
    await rm(dirA, { recursive: true, force: true })
    await rm(dirB, { recursive: true, force: true })
  }
})

test('session_tag add/set/remove/clear on chat session', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(llm)
  await ctx.plugin(agentLoop)
  await ctx.plugin(agents)
  await ctx.plugin(liveSessions)

  const live = await ctx.sessions.create(undefined, { type: 'live' })
  const chat = await ctx.sessions.create()

  // 非 live 调用被拒
  await assert.rejects(
    () =>
      runWithSession(chat.id, () =>
        ctx.tools.invoke('session_tag', { sessionId: chat.id, tag: 'x' }, new AbortController().signal),
      ),
    /only available in live/,
  )

  // add 两个标签（去重）
  const added = (await runWithSession(live.id, () =>
    ctx.tools.invoke('session_tag', { sessionId: chat.id, tags: ['bug', 'feature'] }, new AbortController().signal),
  )) as { tags: string[] }
  assert.deepEqual(added.tags, ['bug', 'feature'])

  // 重复 add 会去重
  const added2 = (await runWithSession(live.id, () =>
    ctx.tools.invoke('session_tag', { sessionId: chat.id, tag: 'bug' }, new AbortController().signal),
  )) as { tags: string[] }
  assert.deepEqual(added2.tags, ['bug', 'feature'])

  // session_list 里能看到 tags
  const listed = (await runWithSession(live.id, () =>
    ctx.tools.invoke('session_list', { type: 'chat' }, new AbortController().signal),
  )) as { sessions: Array<{ id: string; tags: string[] }> }
  assert.deepEqual(listed.sessions.find((s) => s.id === chat.id)?.tags, ['bug', 'feature'])

  // remove
  const removed = (await runWithSession(live.id, () =>
    ctx.tools.invoke('session_tag', { sessionId: chat.id, op: 'remove', tag: 'bug' }, new AbortController().signal),
  )) as { tags: string[] }
  assert.deepEqual(removed.tags, ['feature'])

  // set 整体替换
  const set = (await runWithSession(live.id, () =>
    ctx.tools.invoke('session_tag', { sessionId: chat.id, op: 'set', tags: ['a'] }, new AbortController().signal),
  )) as { tags: string[] }
  assert.deepEqual(set.tags, ['a'])

  // clear 清空
  const cleared = (await runWithSession(live.id, () =>
    ctx.tools.invoke('session_tag', { sessionId: chat.id, op: 'clear' }, new AbortController().signal),
  )) as { tags: string[] }
  assert.deepEqual(cleared.tags, [])
})

test('session_star pin / unpin / toggle on chat session', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(llm)
  await ctx.plugin(agentLoop)
  await ctx.plugin(agents)
  await ctx.plugin(liveSessions)

  const live = await ctx.sessions.create(undefined, { type: 'live' })
  const chat = await ctx.sessions.create()

  // 非 live 被拒
  await assert.rejects(
    () =>
      runWithSession(chat.id, () =>
        ctx.tools.invoke('session_star', { sessionId: chat.id, pinned: true }, new AbortController().signal),
      ),
    /only available in live/,
  )

  // 置顶
  const p1 = (await runWithSession(live.id, () =>
    ctx.tools.invoke('session_star', { sessionId: chat.id, pinned: true }, new AbortController().signal),
  )) as { pinned: boolean }
  assert.equal(p1.pinned, true)

  // 不传 pinned → 切换为取消置顶
  const p2 = (await runWithSession(live.id, () =>
    ctx.tools.invoke('session_star', { sessionId: chat.id }, new AbortController().signal),
  )) as { pinned: boolean }
  assert.equal(p2.pinned, false)

  // 显式置顶回来
  await runWithSession(live.id, () =>
    ctx.tools.invoke('session_star', { sessionId: chat.id, pinned: true }, new AbortController().signal),
  )

  // session_list 能看到 pinned
  const listed = (await runWithSession(live.id, () =>
    ctx.tools.invoke('session_list', { type: 'chat' }, new AbortController().signal),
  )) as { sessions: Array<{ id: string; pinned: boolean }> }
  assert.equal(listed.sessions.find((s) => s.id === chat.id)?.pinned, true)

  // session_configure 也支持 pinned
  const cfg = (await runWithSession(live.id, () =>
    ctx.tools.invoke('session_configure', { sessionId: chat.id, pinned: false }, new AbortController().signal),
  )) as { config: { pinned?: boolean } }
  assert.equal(cfg.config?.pinned, undefined)
})
