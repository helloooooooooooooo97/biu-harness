import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MessageDeriver, type DerivedMessage } from './derive-messages.ts'
import { SessionLog, type SessionEvent } from './session.ts'

// 本文件测 MessageDeriver（日志 → 模型消息的投影）：
//   ① 黄金推导；② 幂等；③ 跳过过程事件；④ afterSeq 裁剪；⑤ 增量 append；⑥ wire 风格 tool_calls；⑦ 未知事件容错。

function parseFixture(): SessionEvent[] {
  // 工具函数：把 sample-session.jsonl 逐行解析成事件数组（附行号，便于定位）。
  const text = readFileSync('./sample-session.jsonl', 'utf8')
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((raw, index) => ({ ...JSON.parse(raw) as object, line: index + 1 }) as SessionEvent)
}

test('样例日志推导出 4 条模型可见消息', () => {
  // 黄金用例：14 行日志应投影出恰好 4 条消息（user / assistant+toolCalls / tool / assistant），且 arguments 是原样字符串。
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
  // 验证纯函数承诺：同日志两次 derive 逐字节一致——回放/fork/测试都依赖这一点。
  const deriver = new MessageDeriver()
  const a = JSON.stringify(deriver.derive(parseFixture()))
  const b = JSON.stringify(deriver.derive(parseFixture()))
  assert.equal(a, b)
})

test('chunk、turn/step 坐标、todo 等事件被跳过', () => {
  // 验证"减法"：过程事件（chunk）、坐标（turn/step）、UI 状态（todo）都不该出现在模型请求里。
  const messages = new MessageDeriver().derive(parseFixture())
  const kinds = ['assistant/chunk', 'turn/start', 'step/start', 'todo/write']
  const serialized = JSON.stringify(messages)
  for (const kind of kinds) {
    assert.ok(!serialized.includes(kind), `不应包含 ${kind}`)
  }
})

test('afterSeq 只推导 seq 更大的模型可见事件', () => {
  // 验证种子裁剪：afterSeq=8 时只剩 seq>8 的模型可见事件（这里是 step 2 的最终回答）。
  const messages = new MessageDeriver().derive(parseFixture(), { afterSeq: 8 })
  assert.equal(messages.length, 1)
  assert.equal(messages[0].role, 'assistant')
  assert.match(messages[0].content ?? '', /当前目录包含/)
})

test('SessionLog 增量 append 后可立即推导', () => {
  // 验证写入即可见：append 后立刻 derive 能拿到，且 content blocks 能提取文本。
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
  // 验证两种编码都支持：content block 形式（用例 1）和 wire 的 tool_calls 字段（本用例），配对 key 一致。
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
  // 验证向前兼容与脏数据容忍：未来事件类型和 unparsed 坏行都不该让 derive 崩溃。
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
