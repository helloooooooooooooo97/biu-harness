# 42-ui-as-plugin 讲义

## 目标

- 实现 **UI 组件即插件**：keyed renderer 注册进 `ui-slots`，可插拔、可热替换。
- 理解 `ConversationNodeDefinition`：业务事件 → 组件的映射契约。
- 实现客户端 HMR：换 renderer 不刷新页面。

## 1. UI 即插件

```ts
const registry = new SlotRegistry()
registry.register('clock', { render: () => '<Clock />' })   // 组件 = 插件
registry.render('clock')                                     // 按 key 渲染
```

UI 组件不是写死在页面里的——它们**注册进 ui-slot**，插件卸载 UI 就消失。这正是 dsh 的 `ui-slots`。

## 2. ConversationNodeDefinition

```ts
interface ConversationNodeDefinition {
  key: string
  render: (data: unknown) => string
}
```

业务事件（`review/start`、`tool/call`…）→ 对应一个 keyed 组件。事件流驱动 UI，而不是 UI 自己记状态（第 21 课 durable 事件）。

## 3. 客户端 HMR

```ts
const reload = clientHmr.reload('clock', { render: () => '<ClockV2 />' })
// 旧 renderer 卸载，新 renderer 挂上，页面不刷新
```

换 UI = 换 renderer 插件（第 16 课热重载思想在客户端）。

## 4. 与 dsh 的对照

dsh 的 `ConversationNodeDefinition` + keyed renderer + `ui-slots` 就是这套；`dsh-client-hmr` 在插件重建时逐帧刷新。本课是它的最小实现。

## 小结

- UI 组件 = 注册进 ui-slot 的插件，按 key 渲染。
- 事件流驱动 UI，组件只负责"渲染这份数据"。
- HMR 换 renderer 不刷新页面。

## 预习

- agent 自己写插件并热挂载？（第 43 课：动态自指。）
