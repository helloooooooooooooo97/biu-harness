import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AgentV2 } from './agent-v2.ts'
import { FixtureStore, MockLlm } from './mock-llm.ts'
import { EchoTool } from './tool.ts'

// 本文件测 AgentV2 + MockLlm 的集成：mock 作为 LlmClient 注入后，循环能否离线跑通。
//   ① 完整离线工具循环；② 离线单步；③ 未命中错误上抛（不吞）。

const helloPath = new URL('./fixtures/hello.jsonl', import.meta.url).pathname
const toolCallPath = new URL('./fixtures/tool-call.jsonl', import.meta.url).pathname

test('离线工具循环：fixture 先给工具调用再给最终回答', async () => {
  // 验证 mock 能驱动完整循环：fixture 第 1 条给工具调用、第 2 条给最终回答，工具结果被回填。
  const store = FixtureStore.fromFiles([toolCallPath])
  const agent = new AgentV2({ client: new MockLlm(store), tools: [new EchoTool()] })
  const out = await agent.run('帮我 echo hi')
  assert.equal(out.steps, 2)
  assert.equal(out.messages[2].role, 'tool')
  assert.equal(out.messages[2].content, 'hi')
  assert.match(out.messages[3].content ?? '', /结果是 hi/)
})

test('离线单步回复', async () => {
  // 验证无工具调用的 fixture 场景：单步结束并返回录制的回复。
  const store = FixtureStore.fromFiles([helloPath])
  const agent = new AgentV2({ client: new MockLlm(store), tools: [new EchoTool()] })
  const out = await agent.run('你好')
  assert.equal(out.steps, 1)
  assert.match(out.messages[1].content ?? '', /录制的回复/)
})

test('未命中时 run 向调用方抛错（不吞掉）', async () => {
  // 验证失败要响亮：mock 未命中时错误从 AgentV2.run 冒泡出来，而不是被静默吞掉。
  const agent = new AgentV2({ client: new MockLlm(new FixtureStore()) })
  await assert.rejects(() => agent.run('没录过'), /mock 未命中/)
})
