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
