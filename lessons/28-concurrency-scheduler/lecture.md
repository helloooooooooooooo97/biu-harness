# 28-concurrency-scheduler 讲义

## 目标

- 实现**并行调度**：`mapLimit`（rolling pool，限制最大并发）与 `Barrier`（组同步）。
- 理解 Code Mode 的 `run_code`：子调用**串行**执行（`runSerial`），保证顺序与可审计。
- 学会"什么时候并行、什么时候串行"的判断。

## 1. 为什么需要并发控制

第 22 课 step 里工具是**串行**执行的（for 循环逐个跑）。真实场景：

- 模型一次要 5 个互不依赖的工具（读 5 个文件）——串行太慢，应该并行；
- 但 5 个都并行会打爆资源（内存/API 配额）——需要**限流**。

`mapLimit(items, limit, fn)` 就是答案：**最多同时跑 limit 个，跑完一个补一个**（rolling pool）。

## 2. 并行 vs 串行

```ts
mapLimit(items, 3, run)   // 最多 3 个并行
runSerial(items, run)     // mapLimit(items, 1) —— 严格串行
```

判断标准：

- **互不依赖、顺序无所谓** → 并行（读多个文件）；
- **有依赖、顺序敏感** → 串行（Code Mode 子调用：上一步的输出是下一步的输入）。

## 3. Barrier：组同步

```ts
const barrier = new Barrier(3)   // 等 3 个任务
tasks.forEach((t) => t.done(() => barrier.arrive()))
await barrier.wait()             // 全部 arrive 后放行
```

"等一组任务全部到达某个点"——比如批量写入后统一提交、或并行工具全部结束才进下一步。

## 4. 与 dsh 的对照

dsh 的调度器在 `tools/execute` 层：工具批并行（rolling pool），Code Mode 的 `run_code` 子调用串行（保持调用/结果相邻，第 27 课流水线里的 `tool/code-dispatch`）。本课的 `mapLimit`/`runSerial`/`Barrier` 是它的最小实现。

## 小结

- `mapLimit` = 限制并发的 rolling pool，结果按输入顺序返回。
- `runSerial` = 并发 1，严格保序。
- `Barrier` = 组同步，等全部到达。

## 预习

- 超时/重试怎么和并发结合？（第 29 课。）
