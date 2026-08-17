import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AgentV2 } from './agent-v2.ts'
import { FixtureStore, MockLlm } from './mock-llm.ts'
import { EchoTool } from './tool.ts'

const helloPath = new URL('./fixtures/hello.jsonl', import.meta.url).pathname
const toolCallPath = new URL('./fixtures/tool-call.jsonl', import.meta.url).pathname

test('离线工具循环：fixture 先给工具调用再给最终回答', async () => {
  const store = FixtureStore.fromFiles([toolCallPath])
  const agent = new AgentV2({ client: new MockLlm(store), tools: [new EchoTool()] })
  const out = await agent.run('帮我 echo hi')
  assert.equal(out.steps, 2)
  assert.equal(out.messages[2].role, 'tool')
  assert.equal(out.messages[2].content, 'hi')
  assert.match(out.messages[3].content ?? '', /结果是 hi/)
})

test('离线单步回复', async () => {
  const store = FixtureStore.fromFiles([helloPath])
  const agent = new AgentV2({ client: new MockLlm(store), tools: [new EchoTool()] })
  const out = await agent.run('你好')
  assert.equal(out.steps, 1)
  assert.match(out.messages[1].content ?? '', /录制的回复/)
})

test('未命中时 run 向调用方抛错（不吞掉）', async () => {
  const agent = new AgentV2({ client: new MockLlm(new FixtureStore()) })
  await assert.rejects(() => agent.run('没录过'), /mock 未命中/)
})
