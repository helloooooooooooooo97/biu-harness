import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as sessionStore from '../storage/session-store.ts'
import * as sessions from '../core/sessions.ts'
import * as tools from '../registry/tools.ts'
import * as systemPrompt from '../core/system-prompt.ts'
import * as llm from './llm.ts'
import * as agentLoop from './agent-loop.ts'
import * as agents from './agents.ts'

test('send without api key still writes a durable turn', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(llm)
  await ctx.plugin(agentLoop)
  await ctx.plugin(agents)
  ctx.agents.configure({ provider: 'deepseek', apiKey: '', model: 'x' })
  const agent = await ctx.agents.create()
  const turn = await agent.send('hello')
  assert.match(turn.text, /本地回声：hello/)
  const events = (await ctx.sessions.require(agent.sessionId)).events.map((item) => item.type)
  assert.equal(events.includes('user/message'), true)
  assert.equal(events.includes('assistant/message'), true)
})
