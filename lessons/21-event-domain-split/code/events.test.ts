import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DURABLE_KINDS, LIVE_KINDS, domainOf } from './events.ts'

// 本文件测事件域映射：① 每个 kind 恰好属于一个域；② 未知事件返回 undefined；③ 两个域不重叠。

test('durable 与 live 集合不重叠且都能被识别', () => {
  // 验证集合完备性：域查询对两类事件都返回正确结果。
  for (const kind of DURABLE_KINDS) assert.equal(domainOf(kind), 'durable')
  for (const kind of LIVE_KINDS) assert.equal(domainOf(kind), 'live')
})

test('两个域的事件名没有交集', () => {
  // 验证设计约束：一个事件不能既是 durable 又是 live。
  const durable = new Set<string>(DURABLE_KINDS)
  for (const kind of LIVE_KINDS) {
    assert.ok(!durable.has(kind), `事件 ${kind} 重复出现在两个域`)
  }
})

test('未知事件返回 undefined（默认拒绝写入）', () => {
  // 验证安全默认：没登记的事件不归任何域，SessionLog 会拒绝它。
  assert.equal(domainOf('future/custom'), undefined)
})
