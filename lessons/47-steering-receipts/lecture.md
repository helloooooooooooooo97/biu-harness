# 47-steering-receipts 讲义

## 目标

- 实现**消息回执**：每条输入有生命周期（accepted → claimed → discarded）。
- 实现 `SteeringService`：steer/inject 返回回执，调用方能确认"收到了吗、用了吗"。
- 把第 24 课 inbox 升级成"可确认"的版本。

## 1. 为什么需要回执

第 24 课的 `steer` 只返回消息本身——调用方不知道"这条纠正到底生效了没"。回执给每个消息一个**状态机**：

```text
accepted（已收下）→ claimed（已被 step 拿走）→（可选）discarded（被取消）
```

## 2. ReceiptStore

```ts
const receipt = store.accept(message)
store.mark(receipt.messageId, 'claimed')
store.get(messageId)   // 查状态
```

## 3. SteeringService

```ts
const receipt = service.steer('别用 bash')   // 进 next-step + 回执 accepted
// step 拿走后 → claimed；取消时 → discarded
```

UI/编排层靠回执判断"纠正生效没有"。

## 4. 与 dsh 的对照

dsh 的 `MessageId` + `agent/inbox/spliced` 事件就是这个：每步增删都是 durable 记录，UI 投影能重建队列。本课的回执是它的最小状态机。

## 小结

- 回执 = 消息状态机（accepted/claimed/discarded）。
- steer/inject 返回回执，调用方可确认。

## 预习

- 所有动作怎么记账？（第 48 课：遥测。）
