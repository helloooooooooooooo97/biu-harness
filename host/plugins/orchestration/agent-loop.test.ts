import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as sessionStore from '../storage/session-store.ts'
import * as sessions from '../core/sessions.ts'
import * as tools from '../registry/tools.ts'
import * as systemPrompt from '../core/system-prompt.ts'
import { AgentLoop, type AgentTurn } from './agent-loop.ts'
import type { AssistantReply, LlmClient, LlmMessage } from './llm.ts'

class ScriptedLlm implements LlmClient {
  constructor(private replies: AssistantReply[]) {}

  async chat(_messages: LlmMessage[]): Promise<AssistantReply> {
    const next = this.replies.shift()
    if (!next) throw new Error('unexpected extra llm.chat')
    return next
  }
}

async function spine() {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  const session = await ctx.sessions.create()
  return { ctx, sessionId: session.id }
}

test('loop returns text when model does not call tools', async () => {
  const { ctx, sessionId } = await spine()
  const loop = new AgentLoop(ctx, new ScriptedLlm([{ content: '你好', toolCalls: [] }]), sessionId, new AbortController().signal)
  const turn = await loop.run([{ kind: 'wake', text: 'hi' }])
  assert.deepEqual(turn, { text: '你好', steps: [] } satisfies AgentTurn)
  assert.equal(ctx.sessions.deriveMessages(sessionId).at(-1)?.content, '你好')
})

test('loop invokes tools then asks the model again', async () => {
  const { ctx, sessionId } = await spine()
  ctx.tools.register({
    name: 'echo',
    description: 'echo',
    parameters: { type: 'object', properties: { text: { type: 'string' } } },
    execute: (args) => String(args.text ?? ''),
  })
  const loop = new AgentLoop(
    ctx,
    new ScriptedLlm([
      { content: null, toolCalls: [{ id: '1', name: 'echo', arguments: '{"text":"pong"}' }] },
      { content: '收到 pong', toolCalls: [] },
    ]),
    sessionId,
    new AbortController().signal,
  )
  const turn = await loop.run([{ kind: 'wake', text: 'echo' }])
  assert.equal(turn.text, '收到 pong')
  assert.deepEqual(turn.steps, [{ name: 'echo', ok: true, detail: 'pong' }])
  const messages = ctx.sessions.deriveMessages(sessionId)
  assert.equal(messages.some((item) => item.role === 'tool' && item.content === 'pong'), true)
})

test('missing tool is a step failure, not a crash', async () => {
  const { ctx, sessionId } = await spine()
  const loop = new AgentLoop(
    ctx,
    new ScriptedLlm([
      { content: null, toolCalls: [{ id: '1', name: 'gone', arguments: '{}' }] },
      { content: '没有这个工具', toolCalls: [] },
    ]),
    sessionId,
    new AbortController().signal,
  )
  const turn = await loop.run([{ kind: 'wake', text: 'x' }])
  assert.equal(turn.steps[0]?.ok, false)
  assert.match(turn.steps[0]?.detail ?? '', /unknown tool: gone/)
  assert.equal(turn.text, '没有这个工具')
})
