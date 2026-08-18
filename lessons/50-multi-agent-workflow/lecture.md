# 50-multi-agent-workflow 讲义

## 目标

- 实现 **workflow**：任务带依赖（DAG），按拓扑顺序执行，并行跑互不依赖的分支。
- 实现**共享上下文/工作区锁**：多 agent 并发写同一文件时防冲突。
- 用第 49 课的子代理 Provider 作为执行者。

## 1. 任务图

```ts
const tasks: WorkflowTask[] = [
  { id: 'plan', run: ... },
  { id: 'code', deps: ['plan'], run: ... },
  { id: 'test', deps: ['code'], run: ... },
  { id: 'docs', deps: ['plan'], run: ... },   // 与 code/test 并行
]
```

依赖决定了顺序：`plan → (code, docs 并行) → test`。用第 14 课的拓扑排序 + 第 28 课的并行调度。

## 2. 工作区锁

```ts
const lock = new WorkspaceLock()
lock.acquire('src/a.ts')    // true
lock.acquire('src/a.ts')    // false（被占用）
lock.release('src/a.ts')
```

多 agent 写同一文件必须先拿锁——防止互相覆盖。

## 3. Orchestrator

```ts
const orchestrator = new Orchestrator(registry, lock)
const results = await orchestrator.run(plan)   // 按依赖编排，收集所有结果
```

编排器 = 任务图 + Provider + 锁，三者组合。

## 4. 与 dsh 的对照

dsh 的 `workflow` 包 + `ctx.subagent` + 子代理工具就是这套；真实编排里还有上下文共享与任务分解（扩展课时）。

## 小结

- 任务图 = DAG，依赖定序、并行分支。
- 工作区锁防并发写冲突。
- 编排器组合图 + Provider + 锁。

## 预习

- 你的成果怎么发布给别人用？（第 51 课。）
