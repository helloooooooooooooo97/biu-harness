import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BenchmarkRunner, type BenchmarkRun } from './index.ts'

// 本文件测评测：成功率与耗时统计。

test('report 统计成功率与耗时', () => {
  const runner = new BenchmarkRunner()
  const report = runner.report([
    { success: true, durationMs: 10 },
    { success: true, durationMs: 20 },
    { success: false, durationMs: 30 },
  ])
  assert.equal(report.successRate, 2 / 3)
  assert.equal(report.avgDurationMs, 20)
  assert.equal(report.medianDurationMs, 20)
})

test('run 收集 token', async () => {
  const runner = new BenchmarkRunner()
  const runs = await runner.run('任务', async () => ({ content: 'ok', usage: { promptTokens: 100, completionTokens: 50 } }), 2)
  assert.equal(runner.report(runs).totalTokens, 300)
})
