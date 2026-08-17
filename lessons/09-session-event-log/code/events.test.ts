import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EVENT_KINDS, isJsonValue } from './events.ts'

test('isJsonValue 接受 JSON 能表达的值', () => {
  assert.equal(isJsonValue(null), true)
  assert.equal(isJsonValue('hi'), true)
  assert.equal(isJsonValue(42), true)
  assert.equal(isJsonValue(true), true)
  assert.equal(isJsonValue([1, 'a', null]), true)
  assert.equal(isJsonValue({ a: [1], b: { c: 'x' } }), true)
})

test('isJsonValue 拒绝无法落盘的值', () => {
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
  for (const kind of ['turn/start', 'step/start', 'user/message', 'assistant/chunk', 'assistant/message', 'tool/call', 'tool/result']) {
    assert.ok(EVENT_KINDS.includes(kind as (typeof EVENT_KINDS)[number]), `缺少 ${kind}`)
  }
})
