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
import * as subagents from './subagents.ts'

async function spine() {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(llm)
  await ctx.plugin(agentLoop)
  await ctx.plugin(agents)
  await ctx.plugin(subagents)
  ctx.agents.configure({ provider: 'deepseek', apiKey: '', model: 'x' })
  return ctx
}

test('in-process subagent uses its own session', async () => {
  const ctx = await spine()
  const result = (await ctx.tools.invoke('subagent_spawn', { prompt: 'child' })) as { sessionId: string; text: string }
  assert.match(result.text, /child/)
  const parent = await ctx.sessions.create()
  assert.notEqual(result.sessionId, parent.id)
})

test('inherit forks parent log into the child session', async () => {
  const ctx = await spine()
  const parent = await ctx.sessions.create()
  await ctx.sessions.append(parent.id, { type: 'user/message', text: 'parent-note', kind: 'wake' })
  const result = (await ctx.tools.invoke('subagent_spawn', {
    prompt: 'child',
    inherit: true,
    parentSessionId: parent.id,
  })) as { sessionId: string; inherited: boolean }
  assert.equal(result.inherited, true)
  const users = ctx.sessions
    .deriveMessages(result.sessionId)
    .filter((item) => item.role === 'user')
    .map((item) => item.content)
  assert.equal(users.includes('parent-note'), true)
  assert.equal(users.includes('child'), true)
})
