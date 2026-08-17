import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TraceParser } from './trace-parser.ts'

const parser = new TraceParser()
const events = parser.parse(readFileSync('./sample-session.jsonl', 'utf8'))

test('解析样例日志得到 14 个事件', () => {
  assert.equal(events.length, 14)
  assert.equal(events[0].kind, 'turn/start')
})

test('汇总统计与样例一致', () => {
  const s = parser.summarize(events)
  assert.equal(s.turns, 1)
  assert.equal(s.steps, 2)
  assert.equal(s.userMessages, 1)
  assert.equal(s.assistantMessages, 2)
  assert.equal(s.assistantChunks, 3)
  assert.equal(s.toolCalls, 1)
  assert.equal(s.toolResults, 1)
  assert.deepEqual(s.token, { prompt: 258, completion: 43, total: 301 })
})

test('坏行被标记为 unparsed 而不是抛错', () => {
  const parsed = parser.parse('{"kind":"turn/start","data":{}}\nnot-json\n')
  assert.equal(parsed.length, 2)
  assert.equal(parsed[1].kind, 'unparsed')
  assert.equal(parser.summarize(parsed).unparsed, 1)
})

test('CSV 包含表头且转义逗号', () => {
  const csv = parser.toCsv(parser.rows(events))
  assert.ok(csv.startsWith('line,time,kind,turn,step,detail'))
  assert.match(csv, /tool\/call/)
})

test('JSON 输出保留 line 与 detail', () => {
  const parsed = JSON.parse(parser.toJson(parser.rows(events))) as Array<Record<string, unknown>>
  assert.ok(parsed.length >= 14)
  assert.ok('line' in parsed[0])
  assert.ok('detail' in parsed[0])
})
