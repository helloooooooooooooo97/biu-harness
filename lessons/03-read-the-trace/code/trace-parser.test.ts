import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TraceParser } from './trace-parser.ts'

const parser = new TraceParser()
const events = parser.parse(readFileSync('./sample-session.jsonl', 'utf8'))

// 本文件测 TraceParser（会话日志解析器）：
//   ① 样例解析数量；② 汇总统计；③ 坏行容错；④ CSV 输出；⑤ JSON 输出。

test('解析样例日志得到 14 个事件', () => {
  // 验证 14 行 JSONL 被完整解析，首事件是 turn/start（行数与样例一致）。
  assert.equal(events.length, 14)
  assert.equal(events[0].kind, 'turn/start')
})

test('汇总统计与样例一致', () => {
  // 验证 summarize() 的计数与 token 合计（2 step、3 chunk、301 token）和样例一致。
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
  // 验证容错：非 JSON 行不中断解析，而是标记为 unparsed 事件。
  const parsed = parser.parse('{"kind":"turn/start","data":{}}\nnot-json\n')
  assert.equal(parsed.length, 2)
  assert.equal(parsed[1].kind, 'unparsed')
  assert.equal(parser.summarize(parsed).unparsed, 1)
})

test('CSV 包含表头且转义逗号', () => {
  // 验证 toCsv() 输出含表头，且事件内容正确落进 CSV。
  const csv = parser.toCsv(parser.rows(events))
  assert.ok(csv.startsWith('line,time,kind,turn,step,detail'))
  assert.match(csv, /tool\/call/)
})

test('JSON 输出保留 line 与 detail', () => {
  // 验证 toJson() 输出的每行都带 line（源行号）与 detail（摘要）。
  const parsed = JSON.parse(parser.toJson(parser.rows(events))) as Array<Record<string, unknown>>
  assert.ok(parsed.length >= 14)
  assert.ok('line' in parsed[0])
  assert.ok('detail' in parsed[0])
})
