import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseConfig } from './config.ts'

// 本文件测配置解析：① 合法配置；② 缺字段；③ 重复 id；④ 结构错误。

test('解析合法配置', () => {
  // 验证 entries 数组被正确解析，enabled 默认 undefined（视为启用）。
  const entries = parseConfig('{"entries":[{"id":"a","name":"tools"},{"id":"b","name":"logger","enabled":false}]}')
  assert.equal(entries.length, 2)
  assert.equal(entries[0].name, 'tools')
  assert.equal(entries[1].enabled, false)
})

test('配置项缺 id 或 name 抛错', () => {
  // 验证校验：每个条目必须含 id 与 name。
  assert.throws(() => parseConfig('{"entries":[{"name":"tools"}]}'), /必须含 id 与 name/)
})

test('重复配置项 id 抛错', () => {
  // 验证 id 唯一性：同 id 两条配置会互相覆盖，必须拒绝。
  assert.throws(
    () => parseConfig('{"entries":[{"id":"a","name":"tools"},{"id":"a","name":"logger"}]}'),
    /重复的配置项 id: a/,
  )
})

test('结构不是 entries 数组时抛错', () => {
  // 验证顶层结构：必须是 { entries: [...] }。
  assert.throws(() => parseConfig('{"foo":1}'), /配置必须是 \{/)
})
