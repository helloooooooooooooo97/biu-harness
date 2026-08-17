import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLog, rows, summarize, toCsv, toJson } from './trace-parser.mjs';

const events = parseLog(readFileSync('./sample-session.jsonl', 'utf8'));

test('解析样例日志得到 11 个事件', () => {
  assert.equal(events.length, 11);
  assert.equal(events[0].kind, 'turn/start');
});

test('汇总统计与样例一致', () => {
  const s = summarize(events);
  assert.equal(s.turns, 1);
  assert.equal(s.steps, 1);
  assert.equal(s.userMessages, 1);
  assert.equal(s.assistantMessages, 2);
  assert.equal(s.assistantChunks, 2);
  assert.equal(s.toolCalls, 1);
  assert.equal(s.toolResults, 1);
  assert.deepEqual(s.token, { prompt: 258, completion: 43, total: 301 });
});

test('坏行被标记为 unparsed 而不是抛错', () => {
  const parsed = parseLog('{"kind":"turn/start","data":{}}\nnot-json\n');
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1].kind, 'unparsed');
  assert.equal(summarize(parsed).unparsed, 1);
});

test('CSV 包含表头且转义逗号', () => {
  const csv = toCsv(rows(events));
  assert.ok(csv.startsWith('line,time,kind,turn,step,detail'));
  assert.match(csv, /tool\/call/);
});

test('JSON 输出保留 line 与 detail', () => {
  const json = toJson(rows(events));
  const parsed = JSON.parse(json);
  assert.ok(parsed.length >= 10);
  assert.ok('line' in parsed[0]);
  assert.ok('detail' in parsed[0]);
});
