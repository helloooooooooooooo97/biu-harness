import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SseParser } from './sse-parser.ts'

// 本文件测 SseParser（SSE 协议解析器）：
//   ① 跨分片缓冲；② CRLF/多行 data；③ flush 收尾；④ 忽略非 data 行。不测 JSON 语义（那在 chat-client.test.ts）。

test('SseParser 跨分片缓冲并切出完整事件', () => {
  // 验证半条事件跨两次 push：第一次只切出完整的前一条，第二次拼出后一条。
  const parser = new SseParser()
  const first = parser.push('data: {"a":1}\n\ndata: {"b":')
  assert.equal(first.length, 1)
  assert.equal(first[0].data, '{"a":1}')
  const second = parser.push('2}\n\n')
  assert.equal(second.length, 1)
  assert.equal(second[0].data, '{"b":2}')
})

test('SseParser 支持 CRLF 与多行 data', () => {
  // 验证兼容 \r\n 换行：一个事件的多行 data 用 \n 连接成一条。
  const parser = new SseParser()
  const events = parser.push('data: line1\r\ndata: line2\r\n\r\n')
  assert.equal(events.length, 1)
  assert.equal(events[0].data, 'line1\nline2')
})

test('SseParser flush 处理无尾随空行的残留', () => {
  // 验证流结束收尾：最后一段没有空行分隔符时，flush() 也要解析出来，不能丢。
  const parser = new SseParser()
  assert.equal(parser.push('data: tail').length, 0)
  const events = parser.flush()
  assert.equal(events.length, 1)
  assert.equal(events[0].data, 'tail')
})

test('SseParser 忽略非 data 行（如 event:）', () => {
  // 验证只认 data: 行：event:/注释行等不影响解析结果。
  const parser = new SseParser()
  const events = parser.push('event: message\ndata: {"x":1}\n\n')
  assert.equal(events.length, 1)
  assert.equal(events[0].data, '{"x":1}')
})
