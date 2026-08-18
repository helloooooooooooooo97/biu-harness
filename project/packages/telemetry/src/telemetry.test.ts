import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CostCalculator, Telemetry, TokenMeter } from './index.ts'

// 本文件测遥测与成本。

test('Telemetry 记账、按 kind 查询、导出 JSONL', () => {
  const telemetry = new Telemetry()
  telemetry.record('step/end', { turn: 1 })
  telemetry.record('tool/result', { callId: 'c1' })
  assert.equal(telemetry.query('step/end').length, 1)
  assert.equal(telemetry.export().split('\n').length, 2)
})

test('TokenMeter 累计与 CostCalculator 计算', () => {
  const meter = new TokenMeter()
  meter.record({ promptTokens: 100, completionTokens: 50 })
  assert.equal(meter.get().total, 150)
  const cost = new CostCalculator({ promptPerM: 1, completionPerM: 2 })
  assert.equal(cost.cost({ prompt: 1_000_000, completion: 500_000 }), 2)
})
