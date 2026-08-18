# 46-context-compaction 讲义

## 目标

- 实现**压力检测**：估算消息 token，超过阈值触发压缩。
- 实现**裁剪与摘要**：长工具结果截断、旧消息换成摘要。
- 发出 durable `compaction/*` 事件，压缩后可重放（第 12 课黄金思想）。

## 1. 压力检测

```ts
const monitor = new PressureMonitor({ limitTokens: 8000 })
monitor.overLimit(messages)   // 超了就要压缩
```

token 估算（约 4 字符/token）只是"够用"的近似——真实 dsh 用 token-meter 精确记账。

## 2. 两个手段

```text
裁剪（prune）：长工具结果只留头尾        ← 信息损失小
摘要（summarize）：最早的几轮换成一句话   ← 信息损失大，但腾空间
```

先裁剪、再摘要，能省则省。

## 3. CompactionRunner

```ts
const result = await compaction.compact(messages)
// result.messages（压缩后的）+ result.summary（摘要）+ 事件
```

压缩不是悄悄丢信息——它把"发生了什么"留进 `compaction/summary` 事件（durable），重放后模型仍知道压缩过。

## 4. 与 dsh 的对照

dsh 的 `compaction-basic`（压力检测 + 摘要）+ `tool-result-pruner`（结果裁剪）+ `token-meter`（精确记账）就是这三件；`compaction/*` 事件进日志。本课是它的最小实现。

## 小结

- 压力检测 → 先裁剪长结果 → 再摘要旧消息。
- 压缩是"换一种表达"，不是丢事实：summary 进 durable 事件。

## 预习

- steering 消息怎么确认收到？（第 47 课。）
