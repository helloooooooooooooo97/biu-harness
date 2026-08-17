import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SseParser } from './sse-parser.ts'

test('SseParser 跨分片缓冲并切出完整事件', () => {
  const parser = new SseParser()
  const first = parser.push('data: {"a":1}\n\ndata: {"b":')
  assert.equal(first.length, 1)
  assert.equal(first[0].data, '{"a":1}')
  const second = parser.push('2}\n\n')
  assert.equal(second.length, 1)
  assert.equal(second[0].data, '{"b":2}')
})

test('SseParser 支持 CRLF 与多行 data', () => {
  const parser = new SseParser()
  const events = parser.push('data: line1\r\ndata: line2\r\n\r\n')
  assert.equal(events.length, 1)
  assert.equal(events[0].data, 'line1\nline2')
})

test('SseParser flush 处理无尾随空行的残留', () => {
  const parser = new SseParser()
  assert.equal(parser.push('data: tail').length, 0)
  const events = parser.flush()
  assert.equal(events.length, 1)
  assert.equal(events[0].data, 'tail')
})

test('SseParser 忽略非 data 行（如 event:）', () => {
  const parser = new SseParser()
  const events = parser.push('event: message\ndata: {"x":1}\n\n')
  assert.equal(events.length, 1)
  assert.equal(events[0].data, '{"x":1}')
})
