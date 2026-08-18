import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CostCalculator, TokenMeter } from './cost.ts'
import { Telemetry } from './telemetry.ts'

// 本文件测遥测与成本：① 记账/查询/导出；② meter；③ 成本。

test('Telemetry 记账、按 kind 查询、导出 JSONL', () => {
  const telemetry = new Telemetry()
  telemetry.record('step/end', { turn: 1, step: 1 })
  telemetry.record('tool/result', { callId: 'c1' })
  assert.equal(telemetry.query('step/end').length, 1)
  assert.equal(telemetry.query().length, 2)
  assert.equal(telemetry.export().split('\n').length, 2)
})

test('TokenMeter 累计 usage', () => {
  const meter = new TokenMeter()
  meter.record({ promptTokens: 100, completionTokens: 50 })
  meter.record({ promptTokens: 200, completionTokens: 0 })
  assert.deepEqual(meter.get(), { prompt: 300, completion: 50, total: 350 })
})

test('CostCalculator 按单价计算', () => {
  const cost = new CostCalculator({ promptPerM: 1, completionPerM: 2 })
  // 1M prompt → 1 元；500K completion → 1 元；合计 2 元
  assert.equal(cost.cost({ prompt: 1_000_000, completion: 500_000 }), 2)
})
