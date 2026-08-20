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

test('cancelled signal stops the turn', async () => {
  const { ctx, sessionId } = await spine()
  const abort = new AbortController()
  const llm: LlmClient = {
    chat: async () => {
      abort.abort()
      throw new DOMException('aborted', 'AbortError')
    },
  }
  const loop = new AgentLoop(ctx, llm, sessionId, abort.signal)
  await assert.rejects(() => loop.run([{ kind: 'wake', text: 'x' }]), /cancelled|AbortError|aborted/i)
})

test('pre-step reject writes a turn with no step', async () => {
  const { ctx, sessionId } = await spine()
  ctx.on('agent/pre-step', (req, next) => ({ ...next(), reject: 'blocked' }))
  const loop = new AgentLoop(ctx, new ScriptedLlm([{ content: 'no', toolCalls: [] }]), sessionId, new AbortController().signal)
  const turn = await loop.run([{ kind: 'wake', text: 'x' }])
  assert.equal(turn.text, 'blocked')
  const types = (await ctx.sessions.require(sessionId)).events.map((item) => item.type)
  assert.equal(types.includes('step/start'), false)
  assert.equal(types.includes('turn/end'), true)
})

test('inject is admitted in the same turn as the wake', async () => {
  const { ctx, sessionId } = await spine()
  const loop = new AgentLoop(ctx, new ScriptedLlm([{ content: 'ok', toolCalls: [] }]), sessionId, new AbortController().signal)
  await loop.run([
    { kind: 'inject', text: 'note' },
    { kind: 'wake', text: 'hi' },
  ])
  const users = ctx.sessions.deriveMessages(sessionId).filter((item) => item.role === 'user').map((item) => item.content)
  assert.deepEqual(users, ['note', 'hi'])
})

test('abort closes the turn as cancelled', async () => {
  const { ctx, sessionId } = await spine()
  const ac = new AbortController()
  const llm: LlmClient = {
    async chat() {
      ac.abort()
      throw new DOMException('aborted', 'AbortError')
    },
  }
  const loop = new AgentLoop(ctx, llm, sessionId, ac.signal)
  await assert.rejects(() => loop.run([{ kind: 'wake', text: 'x' }]), /cancelled/)
  const types = (await ctx.sessions.require(sessionId)).events.map((item) => item.type)
  assert.equal(types.includes('turn/end'), true)
})
