# 53-benchmark-and-review 讲义

## 目标

- 实现**评测基准**：同一任务跑 N 次，统计成功率/耗时/成本。
- 与官方 dsh 做**同任务对照**。
- 产出复盘：差距在哪、下一步学什么。

## 1. BenchmarkRunner

```ts
const runs = await benchmark.run(task, fn, 20)   // 同一任务跑 20 次
const report = benchmark.report(runs)
// 成功率 / 平均耗时 / 中位耗时 / 总成本
```

稳定性指标：**跑一次成功不等于可用**——要跑 N 次看波动。

## 2. 与官方 dsh 对照

```text
同一任务：mini-dsh vs 官方 dsh
对比：成功率、耗时、token、成本
```

对照不是"比输赢"，是**找差距**：哪里慢、哪里错、哪里该抄作业。

## 3. 复盘模板

```text
做得好的：…
差距：…（对照表）
原因：…
下一步：…
```

## 4. 与 dsh 的对照

dsh 仓库自带 `BENCHMARK.md` 与快照测试体系（录制/刷新/回放）。本课的 benchmark 是它的最小版。

## 小结

- 评测 = 同一任务多跑 + 成功率/耗时/成本统计。
- 对照官方找差距，复盘定下一步。
- 53 课收官：从零到一，你有一个可用的 mini-dsh。
