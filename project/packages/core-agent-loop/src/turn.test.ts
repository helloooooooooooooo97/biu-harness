import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AssistantReply, LlmClient, ToolCall } from '@mini-dsh/llm'
import { SessionLog } from '@mini-dsh/core-session'
import { EchoTool, MemoryTools } from '@mini-dsh/core-tools'
import { Agent, PreStepBus, TurnRunner } from './index.ts'

// 本文件测 core-agent-loop：① 完整 turn；② inbox + pre-step 组合。

class FakeLlm implements LlmClient {
  private calls = 0
  async chat(): Promise<AssistantReply> {
    this.calls += 1
    if (this.calls === 1) {
      return {
        content: '我来执行。',
        toolCalls: [{ id: 'c1', name: 'echo', arguments: '{"text":"hi"}' }] as ToolCall[],
      }
    }
    return { content: '结果是 hi。', toolCalls: [] }
  }
}

test('turn 完整跑通：工具调用 → 回填 → 最终回答', async () => {
  const session = new SessionLog()
  const tools = new MemoryTools()
  tools.register(new EchoTool())
  const turn = new TurnRunner({ llm: new FakeLlm(), session, tools })

  const result = await turn.run('帮我 echo hi')

  assert.equal(result.steps, 2)
  assert.match(result.reply, /结果是 hi/)
  const kinds = session.all.map((e) => e.kind)
  assert.deepEqual(kinds, [
    'turn/start',
    'user/message',
    'step/start',
    'assistant/message',
    'tool/call',
    'tool/result',
    'step/end',
    'step/start',
    'assistant/message',
    'step/end',
    'turn/end',
  ])
})

test('inbox 与 pre-step 可组合（输入 → 拦截 → 消息）', () => {
  // 验证 Agent/Inbox/PreStepBus 三个零件能串起来：claim 输入 → pre-step 改写 → 放行。
  const agent = new Agent('a1')
  agent.followup('帮我 echo hi')
  const { turnInput, stepInputs } = agent.inbox.claimNextTurn()
  const pre = new PreStepBus()
  pre.on((decision, _p, next) => {
    if (decision.kind === 'enter') {
      next({ kind: 'enter', messages: decision.messages.map((m) => ({ ...m, content: `[系统] ${m.content}` })) })
    }
  })
  const decision = pre.run({ messages: [turnInput!, ...stepInputs], turn: 1, step: 1 })
  assert.equal(decision.kind, 'enter')
  if (decision.kind === 'enter') {
    assert.match(decision.messages[0].content, /^\[系统\]/)
  }
})
