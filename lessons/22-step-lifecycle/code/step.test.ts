import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { LlmClient, ChatMessage, ToolCall } from './llm.ts'
import { SessionLog } from './session.ts'
import { MemoryTools } from './tools.ts'
import { StepRunner } from './step.ts'

// 本文件测 StepRunner：① 工具 step 事件序列；② 无工具 step；③ 多工具配对；④ 返回的 messages 可继续。

class FakeLlm implements LlmClient {
  constructor(private readonly replies: Array<{ content: string; toolCalls?: ChatMessage['toolCalls'] }>) {}
  async chat(): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const reply = this.replies.shift()!
    return { content: reply.content, toolCalls: reply.toolCalls ?? [] }
  }
}

function setup() {
  const session = new SessionLog()
  const tools = new MemoryTools()
  tools.register({ name: 'echo', description: '回显', execute: async (args) => String(args.text ?? '') })
  return { session, tools }
}

test('工具 step：事件序列完整且 tool 结果配对', async () => {
  // 验证一个 step 的完整事件流：start → assistant → tool/call → tool/result → end。
  const { session, tools } = setup()
  const llm = new FakeLlm([
    {
      content: '我来执行。',
      toolCalls: [{ id: 'c1', name: 'echo', arguments: '{"text":"hi"}' }],
    },
  ])
  const step = new StepRunner({ llm, session, tools }, 1, 1)
  const result = await step.run([{ role: 'user', content: '帮我 echo hi' }])

  assert.equal(result.toolCalls, 1)
  assert.deepEqual(
    session.all.map((e) => e.kind),
    ['step/start', 'assistant/message', 'tool/call', 'tool/result', 'step/end'],
  )
  const toolResult = session.all[3].data
  assert.equal(toolResult.callId, 'c1')
  assert.equal((toolResult.message as { content: string }).content, 'hi')
})

test('无工具 step：没有 tool 事件，toolCalls 为 0', async () => {
  // 验证直接回答路径：事件里不该出现 tool/call 与 tool/result。
  const { session, tools } = setup()
  const llm = new FakeLlm([{ content: '直接回答。' }])
  const step = new StepRunner({ llm, session, tools }, 1, 1)
  const result = await step.run([{ role: 'user', content: '你好' }])

  assert.equal(result.toolCalls, 0)
  assert.equal(result.finalContent, '直接回答。')
  const kinds = session.all.map((e) => e.kind)
  assert.ok(!kinds.includes('tool/call'))
  assert.ok(!kinds.includes('tool/result'))
})

test('多工具 step：每个 callId 都有配对 result', async () => {
  // 验证一对多：两个工具调用各自成对，不串线。
  const { session, tools } = setup()
  tools.register({ name: 'double', description: '翻倍', execute: async (args) => String(Number(args.n) * 2) })
  const llm = new FakeLlm([
    {
      content: '',
      toolCalls: [
        { id: 'c1', name: 'echo', arguments: '{"text":"a"}' },
        { id: 'c2', name: 'double', arguments: '{"n":21}' },
      ],
    },
  ])
  const step = new StepRunner({ llm, session, tools }, 1, 1)
  const result = await step.run([{ role: 'user', content: '两个工具' }])

  assert.equal(result.toolCalls, 2)
  const calls = session.all.filter((e) => e.kind === 'tool/call').map((e) => e.data.callId)
  const results = session.all.filter((e) => e.kind === 'tool/result').map((e) => e.data.callId)
  assert.deepEqual(calls, ['c1', 'c2'])
  assert.deepEqual(results, ['c1', 'c2'])
})

test('返回的 messages 追加了 assistant(toolCalls) 与 tool 结果', async () => {
  // 验证 step 的输出可继续：下一个 step 能看到本轮的工具调用与结果。
  const { session, tools } = setup()
  const llm = new FakeLlm([
    { content: '', toolCalls: [{ id: 'c1', name: 'echo', arguments: '{"text":"hi"}' }] },
  ])
  const step = new StepRunner({ llm, session, tools }, 1, 1)
  const result = await step.run([{ role: 'user', content: 'hi' }])

  assert.equal(result.messages.length, 3)
  assert.equal(result.messages[1].role, 'assistant')
  assert.equal(result.messages[1].toolCalls?.[0]?.id, 'c1')
  assert.equal(result.messages[2].role, 'tool')
  assert.equal(result.messages[2].toolCallId, 'c1')
})
