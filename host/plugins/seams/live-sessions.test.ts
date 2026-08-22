import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as sessionStore from '../storage/session-store.ts'
import * as sessions from '../core/sessions.ts'
import * as tools from '../registry/tools.ts'
import * as systemPrompt from '../core/system-prompt.ts'
import * as llm from '../orchestration/llm.ts'
import * as agentLoop from '../orchestration/agent-loop.ts'
import * as agents from '../orchestration/agents.ts'
import * as liveSessions from './live-sessions.ts'
import { runWithSession } from '../core/session-scope.ts'

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
  )) as { sessions: Array<{ id: string; type: string }> }
  assert.equal(listed.sessions.some((item) => item.id === chat.id), true)
  assert.equal(listed.sessions.some((item) => item.id === live.id), false)

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
  const { AgentLoop } = await import('../orchestration/agent-loop.ts')
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

test('wait=false wake: worker turn/end appends one live note', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(llm)
  await ctx.plugin(agentLoop)
  await ctx.plugin(agents)
  await ctx.plugin(liveSessions)

  ctx.agentLoop.setFactory((_llm, sessionId) => ({
    run: async () => {
      await ctx.sessions.append(sessionId, { type: 'turn/start', turn: 1 })
      await ctx.sessions.append(sessionId, { type: 'assistant/message', text: 'task done' })
      await ctx.sessions.append(sessionId, { type: 'turn/end', turn: 1, reason: 'complete' })
      return { text: 'task done', steps: [] }
    },
  }))
  ctx.agents.configure({ provider: 'deepseek', apiKey: '', model: 'x' })

  const live = await ctx.sessions.create(undefined, { type: 'live' })
  const chat = await ctx.sessions.create()
  await runWithSession(live.id, () =>
    ctx.tools.invoke(
      'session_wake',
      { sessionId: chat.id, text: 'go', wait: false },
      new AbortController().signal,
    ),
  )

  for (let i = 0; i < 40; i += 1) {
    const notes = (await ctx.sessions.require(live.id)).events.filter(
      (item) => item.type === 'assistant/message' && item.text.includes('[指挥席]') && item.text.includes('task done'),
    )
    if (notes.length >= 1) {
      assert.equal(notes.length, 1)
      return
    }
    await new Promise((r) => setTimeout(r, 25))
  }
  assert.fail('timed out waiting for turn/end note')
})
