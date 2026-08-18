import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BenchmarkRunner, type BenchmarkRun } from './benchmark.ts'

// 本文件测评测：① 成功率；② 耗时统计。

test('report 统计成功率', () => {
  const runner = new BenchmarkRunner()
  const runs: BenchmarkRun[] = [
    { success: true, durationMs: 10 },
    { success: true, durationMs: 20 },
    { success: false, durationMs: 30 },
    { success: true, durationMs: 40 },
    { success: false, durationMs: 50 },
  ]
  const report = runner.report(runs)
  assert.equal(report.runs, 5)
  assert.equal(report.successRate, 0.6)
})

test('report 统计平均与中位耗时', () => {
  const runner = new BenchmarkRunner()
  const report = runner.report([
    { success: true, durationMs: 10 },
    { success: true, durationMs: 20 },
    { success: true, durationMs: 30 },
    { success: true, durationMs: 40 },
  ])
  assert.equal(report.avgDurationMs, 25)
  assert.equal(report.medianDurationMs, 25)
})

test('run 收集 token 与成本', async () => {
  const runner = new BenchmarkRunner()
  const runs = await runner.run('任务', async () => ({
    content: 'ok',
    usage: { promptTokens: 100, completionTokens: 50 },
  }), 3)
  assert.equal(runs.length, 3)
  assert.ok(runs.every((r) => r.success))
  assert.equal(runner.report(runs).totalTokens, 450)
})
