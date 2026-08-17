# 30-approval-and-permission 讲义

## 目标

- 实现**审批**：`ApprovalGate`（可注入决策者，缺省拒绝）。
- 实现**权限预设**：read-only / workspace-write / full，把工具动作映射为 allow/deny/ask。
- 把审批接到第 27 课的流水线（approval 关卡）。

## 1. 审批：工具执行前的"人"关卡

```ts
const gate = new ApprovalGate(async (question) => {
  console.log(question)         // 真实环境：弹 UI 给用户
  return true                   // 用户点"允许"
})
await gate.ask('允许调用工具 bash？')
```

两个设计点：

- **可注入**：决策者可以是 UI、CLI、策略服务——`ApprovalGate` 只负责"问"，不负责"答"；
- **缺省拒绝**：没有 resolver 时 `ask` 返回 false（fail-closed）——没人批准就不执行。

## 2. 权限预设：策略即数据

```ts
policyFor('read-only', { name: 'read_file', kind: 'read' })  // 'allow'
policyFor('read-only', { name: 'bash', kind: 'exec' })       // 'deny'
policyFor('workspace-write', { name: 'bash', kind: 'exec' }) // 'ask'（要审批）
```

| 预设 | read | write | exec |
| --- | --- | --- | --- |
| read-only | allow | deny | deny |
| workspace-write | allow | allow | ask |
| full | allow | allow | allow |

三档语义：**allow 直接放行 / deny 直接拒绝 / ask 走审批**。

## 3. 与第 27 课流水线的对接

第 27 课的 `ToolPipeline` 有 approval 关卡——把 `decide(preset, action, gate)` 当作流水线的 `ApprovalLike` 注入即可：

```ts
pipeline.setApproval({ ask: (q) => decide('workspace-write', { name: 'bash', kind: 'exec' }, gate) })
```

## 4. 与 dsh 的对照

dsh 的 `ctx.approval` 是真实审批 seam，`permission-presets` 包提供预设；第 44 课（workspace guard）会把 deny 从"审批"提升为"单调 guard"。本课是这两者的最小实现。

## 小结

- ApprovalGate：可注入决策者，缺省拒绝（fail-closed）。
- 权限预设：read/write/exec → allow/deny/ask 的映射表。
- 审批是流水线的"人"关卡，预设是它的"策略"输入。

## 预习

- 安全策略为什么有时候不能用审批？（第 44 课：单调 guard 与工作区边界。）
