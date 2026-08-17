# 27-execution-pipeline 讲义

## 目标

- 实现工具执行的完整流水线：`pre → guards → approval → execute → post → finalize → result`。
- 理解 waterfall 拦截（第 15/25 课模式）与**单调 guard**（一旦拒绝，后续无法撤销）。
- 用第 26 课的 `defineTool` 作为流水线的"执行体"。

## 1. 流水线长什么样

第 22 课 step 里"直接执行工具"太裸——没有权限、没有审批、没有后处理。第 27 课给它装上完整关卡：

```text
tools/pre-execute（waterfall）  → 监听器可拒绝/放行
tools guard（单调）             → 一旦 deny，后续无法撤销
ctx.approval（审批）            → 人工/策略决定
execute（工具体）               → 真正的执行
tools/post-execute（waterfall） → 改写结果文本
finalizeContent                 → 内容级收尾（抛错 = isError）
tools/result（通知）            → 冻结的权威结果
```

## 2. 两类"拒绝"的区别

| | pre-execute 瀑布 | 单调 guard |
| --- | --- | --- |
| 语义 | 可插拔策略，可被改写 | 硬性安全底线 |
| 顺序 | 按注册序，可短路 | 一旦 deny 就定死 |
| 例子 | 钩子改写、审批入口 | 工作区边界（第 44 课） |

guard 叫"单调"是因为：**只允许从 allow → deny，不允许反向**——安全策略不能被后来的插件撤销。

## 3. 与 dsh 的对照

dsh 的工具流水线完全一致：`tools/pre-execute`、`ctx.tools.guard()`、`ctx.approval`、`tools/execute`、`tools/post-execute`、`finalizeContent`、`tools/result`。本课是它的教学版——第 30 课会把 approval 换成完整的权限预设。

## 小结

- 七段流水线：pre → guards → approval → execute → post → finalize → result。
- waterfall 管策略，单调 guard 管底线。
- 失败也是结果（isError），不是崩溃。

## 预习

- 多个工具调用并行执行？（第 28 课：并发调度。）
