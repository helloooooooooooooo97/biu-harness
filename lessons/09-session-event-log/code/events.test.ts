import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EVENT_KINDS, isJsonValue } from './events.ts'

// 本文件测事件词汇表与 JSON 校验：① isJsonValue 接受值；② 拒绝无法落盘的值；③ 词汇表完整性。

test('isJsonValue 接受 JSON 能表达的值', () => {
  // 验证 null/字符串/有限数字/布尔/数组/普通对象都可通过校验。
  assert.equal(isJsonValue(null), true)
  assert.equal(isJsonValue('hi'), true)
  assert.equal(isJsonValue(42), true)
  assert.equal(isJsonValue(true), true)
  assert.equal(isJsonValue([1, 'a', null]), true)
  assert.equal(isJsonValue({ a: [1], b: { c: 'x' } }), true)
})

test('isJsonValue 拒绝无法落盘的值', () => {
  // 验证 undefined/函数/Date/Map/Set/NaN/Infinity/bigint/含函数对象都被拒绝——这些无法无损 JSON 序列化。
  assert.equal(isJsonValue(undefined), false)
  assert.equal(isJsonValue(() => {}), false)
  assert.equal(isJsonValue(new Date()), false)
  assert.equal(isJsonValue(new Map()), false)
  assert.equal(isJsonValue(new Set()), false)
  assert.equal(isJsonValue(NaN), false)
  assert.equal(isJsonValue(Infinity), false)
  assert.equal(isJsonValue(10n), false)
  assert.equal(isJsonValue({ cb: () => {} }), false)
})

test('事件词汇表包含核心会话事件', () => {
  // 验证 EVENT_KINDS 覆盖日志的七类核心事件（turn/step/message/chunk/tool）。
  for (const kind of ['turn/start', 'step/start', 'user/message', 'assistant/chunk', 'assistant/message', 'tool/call', 'tool/result']) {
    assert.ok(EVENT_KINDS.includes(kind as (typeof EVENT_KINDS)[number]), `缺少 ${kind}`)
  }
})
