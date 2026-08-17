import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AgentV2 } from './agent-v2.ts'
import { EchoTool, type Tool } from './tool.ts'
import { echoCall, fakeFetchSequence } from './test-utils.ts'

test('正常工具循环：调用工具 → 回填 → 最终回复', async () => {
  const fetchImpl = fakeFetchSequence([
    { choices: [{ message: echoCall('call_1', '{"text":"hi"}') }] },
    { choices: [{ message: { role: 'assistant', content: '完成。' } }] },
  ])
  const agent = new AgentV2({ apiKey: 'sk-test', fetchImpl, tools: [new EchoTool()] })
  const out = await agent.run('帮我 echo hi')

  assert.equal(out.steps, 2)
  assert.equal(out.messages.length, 4)
  assert.equal(out.messages[0].role, 'user')
  assert.equal(out.messages[1].role, 'assistant')
  assert.equal(out.messages[1].toolCalls?.[0]?.name, 'echo')
  assert.equal(out.messages[2].role, 'tool')
  assert.equal(out.messages[2].toolCallId, 'call_1')
  assert.equal(out.messages[2].content, 'hi')
  assert.equal(out.messages[3].role, 'assistant')
  assert.equal(out.messages[3].content, '完成。')
})

test('工具执行失败返回错误文本而不是抛异常', async () => {
  const failTool: Tool = {
    name: 'boom',
    description: '总是失败',
    parameters: {},
    async execute() {
      throw new Error('爆炸了')
    },
  }
  const fetchImpl = fakeFetchSequence([
    {
      choices: [{
        message: {
          role: 'assistant',
          content: '试试',
          tool_calls: [{ id: 'c1', type: 'function', function: { name: 'boom', arguments: '{}' } }],
        },
      }],
    },
    { choices: [{ message: { role: 'assistant', content: '知道了。' } }] },
  ])
  const agent = new AgentV2({ apiKey: 'sk-test', fetchImpl, tools: [failTool] })
  const out = await agent.run('测试失败工具')
  assert.match(out.messages[2].content ?? '', /错误: 爆炸了/)
  assert.equal(out.messages[3].content, '知道了。')
})

test('未知工具同样回填错误文本', async () => {
  const fetchImpl = fakeFetchSequence([
    {
      choices: [{
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ id: 'c1', type: 'function', function: { name: 'nope', arguments: '{}' } }],
        },
      }],
    },
    { choices: [{ message: { role: 'assistant', content: '好的。' } }] },
  ])
  const agent = new AgentV2({ apiKey: 'sk-test', fetchImpl, tools: [new EchoTool()] })
  const out = await agent.run('调用不存在的工具')
  assert.match(out.messages[2].content ?? '', /未知工具: nope/)
})

test('没有 tool_calls 时单步结束', async () => {
  const fetchImpl = fakeFetchSequence([
    { choices: [{ message: { role: 'assistant', content: '直接回答。' } }] },
  ])
  const agent = new AgentV2({ apiKey: 'sk-test', fetchImpl })
  const out = await agent.run('你好')
  assert.equal(out.steps, 1)
  assert.equal(out.messages.length, 2)
})

test('wire 格式：assistant 带 tool_calls，tool 带 tool_call_id', async () => {
  const bodies: unknown[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    bodies.push(JSON.parse(String(init?.body)))
    const next = bodies.length === 1 ? echoCall('call_1', '{"text":"hi"}') : { role: 'assistant', content: '完' }
    return { ok: true, status: 200, async json() { return { choices: [{ message: next }] } }, async text() { return '' } } as Response
  }
  const agent = new AgentV2({ apiKey: 'sk-test', fetchImpl, tools: [new EchoTool()] })
  await agent.run('hi')

  const first = bodies[0] as { messages: unknown[] }
  const second = bodies[1] as { messages: unknown[] }
  assert.equal(first.messages.length, 1)
  const assistant = second.messages[1] as { tool_calls: Array<{ function: { name: string } }> }
  assert.equal(assistant.tool_calls[0].function.name, 'echo')
  const toolMsg = second.messages[2] as { role: string; tool_call_id: string }
  assert.equal(toolMsg.role, 'tool')
  assert.equal(toolMsg.tool_call_id, 'call_1')
})

test('maxSteps 超限抛错', async () => {
  const fetchImpl = fakeFetchSequence([
    { choices: [{ message: echoCall('c1', '{"text":"a"}') }] },
    { choices: [{ message: echoCall('c2', '{"text":"b"}') }] },
    { choices: [{ message: echoCall('c3', '{"text":"c"}') }] },
  ])
  const agent = new AgentV2({ apiKey: 'sk-test', fetchImpl, tools: [new EchoTool()], maxSteps: 2 })
  await assert.rejects(() => agent.run('循环'), /超过最大 step 数 2/)
})
