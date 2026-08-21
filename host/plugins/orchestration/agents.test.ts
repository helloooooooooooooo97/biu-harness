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

test('inject waits for the next wake and is logged first', async () => {
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
  agent.inject('note')
  await agent.send('go')
  const users = (await ctx.sessions.require(agent.sessionId)).events.filter((item) => item.type === 'user/message')
  assert.deepEqual(users.map((item) => ('text' in item ? item.text : '')), ['note', 'go'])
  assert.equal(users[0] && 'kind' in users[0] ? users[0].kind : '', 'inject')
})

test('send wait:false returns immediately; isBusy clears when done', async () => {
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
  const pending = agent.send('async-hi', { wait: false })
  assert.equal(ctx.agents.isBusy(agent.sessionId), true)
  const early = await pending
  assert.deepEqual(early, { text: '', steps: [] })
  // 等后台回合结束
  for (let i = 0; i < 50 && ctx.agents.isBusy(agent.sessionId); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  assert.equal(ctx.agents.isBusy(agent.sessionId), false)
  assert.equal(
    (await ctx.sessions.require(agent.sessionId)).events.some(
      (event) => event.type === 'assistant/message',
    ),
    true,
  )
})
