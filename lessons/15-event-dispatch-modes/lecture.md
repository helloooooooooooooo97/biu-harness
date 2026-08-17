# 15-event-dispatch-modes 讲义

## 目标

- 实现事件四模式：`emit` / `waterfall` / `parallel` / `serial`。
- 重点吃透 **waterfall 的委托与短路**——这是 dsh 拦截/改写机制的心脏。
- 学会"选模式"：观察用 emit，包装用 waterfall，扇出用 parallel，有序流程用 serial。

## 1. 四模式总览

第 11 课给每个事件声明了 `@mode`；第 15 课兑现：

| 模式 | 等待 | 顺序 | 有返回值 | 一句话 |
| --- | --- | --- | --- | --- |
| `emit` | 否 | 注册序 | 无 | 广播，大家看看 |
| `waterfall` | 否 | 注册序 | 有 | 值在监听器间传递，可短路 |
| `parallel` | 是 | 并行 | 数组 | 同时干，等全部 |
| `serial` | 是 | 注册序 | 有 | 一个个来，等前一个 |

```ts
bus.emit('user/message', payload)                    // 观察
bus.waterfall('prompt', 'base', ctx)                 // 改写/决策
await bus.parallel('notify', ...)                    // 并发通知
await bus.serial('lifecycle:before-stop', ...)       // 有序钩子
```

## 2. waterfall：委托与短路

waterfall 的监听器签名是 `(value, ...args, next)`：

```ts
bus.on('prompt', (value, _ctx, next) => {
  next(`${value} + sectionA`)     // 委托：改完交给下一个
})
bus.on('prompt', (value, _ctx, next) => {
  next(`${value} + sectionB`)
})
const result = bus.waterfall('prompt', 'base', ctx)
// result === 'base + sectionA + sectionB'
```

两种终止方式：

- **委托**：调用 `next(新值)`，新值传给下一个监听器；
- **短路**：不调 next、直接 `return 结果`——**后面的人不再执行**，返回值就是最终结果。

短路是权限/拦截场景的关键：一个监听器说"拒绝"，后面谁都不用问了。

## 3. 什么时候用哪种

| 需求 | 模式 |
| --- | --- |
| 记录、通知、渲染 | `emit` |
| 请求改写、提示词组装、权限决策 | `waterfall` |
| 并发发通知、并行执行互不依赖的钩子 | `parallel` |
| 强顺序的生命周期（启动/停止前） | `serial` |

## 4. 与 dsh 的对照

dsh 的事件带 `@mode` 标签，分发点必须与声明一致（生成器校验）。真实用法：

- `agent/pre-step`、`agent/request`、`tools/pre-execute`、`tools/execute` 都是 **waterfall**——拦截器通过 next 委托、通过不调 next 拒绝；
- `agent/turn-stopping` 是 **serial**——按序执行，不能短路；
- `session/*` 通知类大多是 **emit**。

第 25/27 课会用本课的 EventBus 实现真正的 pre-step 和工具流水线。

## 小结

- 四模式 = 观察 / 包装 / 扇出 / 有序，各管一种需求。
- waterfall 的 next 委托 + 短路，是 harness 拦截机制的心脏。
- 模式是事件的公开契约，选错模式就是改契约。

## 预习

- 权限插件要在"拒绝"后阻止工具执行——用 waterfall 还是 guard？（第 27 课：单调 guard。）
