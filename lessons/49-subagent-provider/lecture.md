# 49-subagent-provider 讲义

## 目标

- 定义**子代理能力缝**：`SubagentProvider`（spawn 子任务 → 句柄 + 结果）。
- 实现两个 Provider：**in-process**（进程内跑一个子 agent）与 **ACP/远程**（canned 模拟）。
- 用注册表换 Provider，编排层无感。

## 1. 子代理 = 能力缝

```ts
interface SubagentProvider {
  name: string
  spawn(prompt: string, opts?): SubagentHandle   // { id, result }
}
```

这是第 34 课能力缝在"人"上的应用：Definition（接口）+ Provider（inprocess/acp/codex）+ Consumer（编排器）。

## 2. InProcessProvider

```ts
const provider = new InProcessProvider(llm)   // 复用同一个 LLM 跑子任务
const handle = provider.spawn('统计文件行数')
const result = await handle.result
```

进程内子代理 = 用同一套 loop 跑一个独立任务，返回最终结果。

## 3. 换 Provider

```ts
registry.register(new InProcessProvider(llm))
registry.register(new AcpProviderMock())   // 远程/ACP
registry.get('acp').spawn(...)
```

换子代理后端 = 换 Provider，编排器不改。

## 4. 与 dsh 的对照

dsh 的 `subagent` seam 有 `subagent-inprocess`、`subagent-acp`、`subagent-codex`、`subagent-claude-code`——同一个接口，多种执行世界。第 50 课用它做多 agent 编排。

## 小结

- 子代理 = 能力缝：Definition/Provider/Consumer。
- inprocess 复用本进程，ACP/远程在别处执行。
- 换 Provider 编排层无感。

## 预习

- 多个子代理怎么编排？（第 50 课。）
