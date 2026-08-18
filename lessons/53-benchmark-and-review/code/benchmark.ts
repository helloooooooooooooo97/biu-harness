/** 评测基准：同一任务多跑 + 统计（第 53 课）。 */

export interface BenchmarkRun {
  success: boolean
  durationMs: number
  tokens?: number
  cost?: number
}

export interface BenchmarkReport {
  runs: number
  successRate: number
  avgDurationMs: number
  medianDurationMs: number
  totalTokens: number
  totalCost: number
}

export class BenchmarkRunner {
  async run(task: string, fn: (task: string, index: number) => Promise<{ content: string; usage?: { promptTokens: number; completionTokens: number } }>, times: number): Promise<BenchmarkRun[]> {
    const runs: BenchmarkRun[] = []
    for (let i = 0; i < times; i += 1) {
      const start = Date.now()
      try {
        const result = await fn(task, i)
        const tokens = result.usage ? result.usage.promptTokens + result.usage.completionTokens : 0
        runs.push({ success: true, durationMs: Date.now() - start, tokens, cost: tokens * 0.00001 })
      } catch {
        runs.push({ success: false, durationMs: Date.now() - start })
      }
    }
    return runs
  }

  report(runs: BenchmarkRun[]): BenchmarkReport {
    const successes = runs.filter((r) => r.success)
    const durations = runs.map((r) => r.durationMs).sort((a, b) => a - b)
    const mid = Math.floor(durations.length / 2)
    return {
      runs: runs.length,
      successRate: runs.length === 0 ? 0 : successes.length / runs.length,
      avgDurationMs: durations.length === 0 ? 0 : durations.reduce((a, b) => a + b, 0) / durations.length,
      medianDurationMs: durations.length === 0 ? 0 : (durations.length % 2 === 0 ? (durations[mid - 1] + durations[mid]) / 2 : durations[mid]),
      totalTokens: successes.reduce((sum, r) => sum + (r.tokens ?? 0), 0),
      totalCost: successes.reduce((sum, r) => sum + (r.cost ?? 0), 0),
    }
  }
}
