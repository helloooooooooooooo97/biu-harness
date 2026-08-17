import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MessageDeriver, type DerivedMessage } from './derive-messages.ts'
import { SessionLog, type SessionEvent } from './session.ts'

function parseFixture(): SessionEvent[] {
  const text = readFileSync('./sample-session.jsonl', 'utf8')
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((raw, index) => ({ ...JSON.parse(raw) as object, line: index + 1 }) as SessionEvent)
}

test('样例日志推导出 4 条模型可见消息', () => {
  const messages = new MessageDeriver().derive(parseFixture())
  assert.equal(messages.length, 4)
  assert.deepEqual(messages[0], { role: 'user', content: '列出当前目录的文件' })
  assert.equal(messages[1].role, 'assistant')
  assert.equal(messages[1].toolCalls?.[0]?.name, 'bash')
  assert.equal(messages[1].toolCalls?.[0]?.arguments, '{"command":"ls -la"}')
  assert.deepEqual(messages[2], {
    role: 'tool',
    toolCallId: 'call_1',
    content: 'README.md  package.json  src/',
  })
  assert.equal(messages[3].role, 'assistant')
  assert.match(messages[3].content ?? '', /当前目录包含/)
})

test('推导是幂等的：同一日志两次推导结果一致', () => {
  const deriver = new MessageDeriver()
  const a = JSON.stringify(deriver.derive(parseFixture()))
  const b = JSON.stringify(deriver.derive(parseFixture()))
  assert.equal(a, b)
})

test('chunk、turn/step 坐标、todo 等事件被跳过', () => {
  const messages = new MessageDeriver().derive(parseFixture())
  const kinds = ['assistant/chunk', 'turn/start', 'step/start', 'todo/write']
  const serialized = JSON.stringify(messages)
  for (const kind of kinds) {
    assert.ok(!serialized.includes(kind), `不应包含 ${kind}`)
  }
})

test('afterSeq 只推导 seq 更大的模型可见事件', () => {
  const messages = new MessageDeriver().derive(parseFixture(), { afterSeq: 8 })
  assert.equal(messages.length, 1)
  assert.equal(messages[0].role, 'assistant')
  assert.match(messages[0].content ?? '', /当前目录包含/)
})

test('SessionLog 增量 append 后可立即推导', () => {
  const log = new SessionLog()
  log.append('user/message', { role: 'user', content: '你好' })
  log.append('assistant/message', {
    role: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text: '你好！' }] },
  })
  const messages = new MessageDeriver().derive(log.all)
  assert.equal(log.length, 2)
  assert.deepEqual(
    messages.map((m: DerivedMessage) => m.role),
    ['user', 'assistant'],
  )
  assert.equal(messages[1].content, '你好！')
})

test('wire 风格 tool_calls（tool_calls 字段）也能推导', () => {
  const log = new SessionLog()
  log.append('assistant/message', {
    role: 'assistant',
    message: {
      role: 'assistant',
      content: '试试',
      tool_calls: [{ id: 'c9', type: 'function', function: { name: 'bash', arguments: '{"command":"ls"}' } }],
    },
  })
  log.append('tool/result', { callId: 'c9', message: { role: 'tool', content: 'README.md' } })
  const messages = new MessageDeriver().derive(log.all)
  assert.equal(messages[0].toolCalls?.[0]?.id, 'c9')
  assert.equal(messages[1].toolCallId, 'c9')
})

test('未知事件与坏行被安全跳过', () => {
  const log = new SessionLog()
  log.append('future/custom-event', { anything: 1 })
  log.append('user/message', { role: 'user', content: 'hi' })
  const events: SessionEvent[] = [
    ...log.all,
    { line: 99, kind: 'unparsed', data: { raw: 'not-json' } },
  ]
  const messages = new MessageDeriver().derive(events)
  assert.equal(messages.length, 1)
  assert.equal(messages[0].content, 'hi')
})
