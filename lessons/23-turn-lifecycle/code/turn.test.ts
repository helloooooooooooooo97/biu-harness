import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { LlmClient, ChatMessage, ToolCall } from './llm.ts'
import { SessionLog } from './session.ts'
import { MemoryTools } from './tools.ts'
import { TurnRunner } from './turn.ts'

// 本文件测 TurnRunner：① 单步 turn；② 三步 turn；③ 空输入；④ maxSteps 护栏。

class FakeLlm implements LlmClient {
  constructor(private readonly replies: Array<{ content: string; toolCalls?: ChatMessage['toolCalls'] }>) {}
  async chat(): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const reply = this.replies.shift()!
    return { content: reply.content, toolCalls: reply.toolCalls ?? [] }
  }
}

function setup(replies: Array<{ content: string; toolCalls?: ChatMessage['toolCalls'] }>) {
  const session = new SessionLog()
  const tools = new MemoryTools()
  tools.register({ name: 'echo', description: '回显', execute: async (args) => String(args.text ?? '') })
  return { llm: new FakeLlm(replies), session, tools }
}

test('单步 turn：直接回答，事件完整', async () => {
  // 验证最小回合：turn/start → user/message → step → turn/end。
  const { llm, session, tools } = setup([{ content: '你好！' }])
  const turn = new TurnRunner({ llm, session, tools })
  const result = await turn.run('hi')

  assert.equal(result.turn, 1)
  assert.equal(result.steps, 1)
  assert.equal(result.reply, '你好！')
  assert.deepEqual(
    session.all.map((e) => e.kind),
    ['turn/start', 'user/message', 'step/start', 'assistant/message', 'step/end', 'turn/end'],
  )
})

test('三步 turn：要工具 → 要工具 → 最终回答', async () => {
  // 验证多 step：每个 step 都有 start/end，回合在不再要工具时关闭。
  const { llm, session, tools } = setup([
    { content: '第一步', toolCalls: [{ id: 'c1', name: 'echo', arguments: '{"text":"a"}' }] },
    { content: '第二步', toolCalls: [{ id: 'c2', name: 'echo', arguments: '{"text":"b"}' }] },
    { content: '最终回答' },
  ])
  const turn = new TurnRunner({ llm, session, tools })
  const result = await turn.run('帮我处理')

  assert.equal(result.steps, 3)
  assert.equal(result.reply, '最终回答')
  const kinds = session.all.map((e) => e.kind)
  assert.equal(kinds.filter((k) => k === 'step/start').length, 3)
  assert.equal(session.all.at(-1)?.kind, 'turn/end')
  assert.equal((session.all.at(-1)?.data as { reason: string }).reason, 'completed')
})

test('空输入：0 个 step，仍记录 turn/start 与 turn/end', async () => {
  // 验证空回合：turn 先开先关，日志保留"这次尝试发生过"。
  const { llm, session, tools } = setup([])
  const turn = new TurnRunner({ llm, session, tools })
  const result = await turn.run('   ')

  assert.equal(result.steps, 0)
  assert.equal(result.reply, '')
  assert.deepEqual(
    session.all.map((e) => e.kind),
    ['turn/start', 'turn/end'],
  )
})

test('maxSteps 护栏：模型永远要工具时抛错', async () => {
  // 验证死循环保护：超过 maxSteps 抛错，不能无限烧请求。
  const { llm, session, tools } = setup([
    { content: '', toolCalls: [{ id: 'c1', name: 'echo', arguments: '{}' }] },
    { content: '', toolCalls: [{ id: 'c2', name: 'echo', arguments: '{}' }] },
    { content: '', toolCalls: [{ id: 'c3', name: 'echo', arguments: '{}' }] },
  ])
  const turn = new TurnRunner({ llm, session, tools, maxSteps: 2 })
  await assert.rejects(() => turn.run('循环'), /超过最大 step 数 2/)
})
