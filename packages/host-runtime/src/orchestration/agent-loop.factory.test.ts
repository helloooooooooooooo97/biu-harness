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
import { AgentLoop, type ClaimedInput } from './agent-loop.ts'
import type { AssistantReply, LlmClient, LlmMessage } from './llm.ts'

class ScriptedLlm implements LlmClient {
  constructor(private replies: AssistantReply[]) {}
  async chat(_messages: LlmMessage[]): Promise<AssistantReply> {
    const next = this.replies.shift()
    if (!next) throw new Error('unexpected extra llm.chat')
    return next
  }
}

test('setFactory swaps the runner used by agents', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(llm)
  await ctx.plugin(agentLoop)
  await ctx.plugin(agents)
  ctx.agentLoop.setFactory(() => ({
    run: async (claimed: ClaimedInput[]) => ({
      text: `factory:${claimed.map((item) => item.text).join(',')}`,
      steps: [],
    }),
  }))
  ctx.agents.configure({ provider: 'deepseek', apiKey: '', model: 'x' })
  const agent = await ctx.agents.create()
  const turn = await agent.send('hi')
  assert.equal(turn.text, 'factory:hi')
})

test('system prompt is appended once per turn, not every step', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  ctx.tools.register({
    name: 'echo',
    description: 'echo',
    parameters: { type: 'object', properties: { text: { type: 'string' } } },
    execute: (args) => String(args.text ?? ''),
  })
  const session = await ctx.sessions.create()
  const loop = new AgentLoop(
    ctx,
    new ScriptedLlm([
      { content: null, toolCalls: [{ id: '1', name: 'echo', arguments: '{"text":"a"}' }] },
      { content: 'done', toolCalls: [] },
    ]),
    session.id,
    new AbortController().signal,
  )
  await loop.run([{ kind: 'wake', text: 'x' }])
  const prompts = (await ctx.sessions.require(session.id)).events.filter((item) => item.type === 'system/prompt')
  assert.equal(prompts.length, 1)
})
