# 11-event-vocabulary 讲义

## 目标

- 把第 03/09 课的事件表升级成**类型化事件词汇表**：事件名 → 负载类型，一一对应。
- 学会用 **TypeScript 声明合并**让插件扩展事件表。
- 理解 `@mode` 元数据：每个事件声明自己的调度模式（第 15 课实现分发）。

## 1. 事件表 = 插件间的通信契约

会话日志里的事件不能是"随便一个字符串 + 随便一个对象"。第 11 课把它变成一张**类型化事件表**：

```ts
export interface SessionEventMap {
  'turn/start': { turn: number }
  'user/message': UserMessagePayload
  'assistant/message': { turn: number; step: number } & AssistantMessagePayload
  'tool/call': { turn: number; step: number } & ToolCallPayload
  'tool/result': { turn: number; step: number } & ToolResultPayload
  ...
}
```

这张表同时承担两个角色：

- **运行时词汇表**：事件名是"事实的身份证"（第 09 课的 `EVENT_KINDS` 升级版）；
- **编译期契约**：`on('tool/call', listener)` 时，TS 强制 listener 收到的负载必须含 `turn/step/callId/name/arguments`——写错字段立刻报错。

## 2. 类型安全的 TypedEventBus

```ts
const bus = new TypedEventBus()
bus.on('user/message', (data) => console.log(data.content))   // data 的类型被自动推导
bus.emit('user/message', { role: 'user', content: '你好' })   // 负载形状由事件表把关
```

`on` 返回 disposer，移除监听器（延续第 13 课"注册即可逆"的思想）。

## 3. 声明合并：插件如何扩展事件表

dsh 的事件表是"合并可扩展的"。TS 的 **declaration merging** 让插件往别人的接口里加字段：

```ts
// plugin-hook.ts
declare module './events.ts' {
  interface SessionEventMap {
    'hook/invoked': { hook: string; args: unknown; at: string }
  }
}
```

只要这个文件被 import 过，全项目里 `bus.on('hook/invoked', ...)` 就自动类型合法——**插件不需要改内核代码，就能让事件表认识自己的事件**。这就是"没有特权核心，扩展就是挂一个插件"在类型层的体现。

## 4. @mode：事件的调度模式

每个事件还要声明"怎么分发"：

```ts
export type EventMode = 'emit' | 'waterfall' | 'parallel' | 'serial'

export const EVENT_MODES: Partial<Record<EventKind, EventMode>> = {
  'turn/start': 'emit',
  ...
}
```

四种模式（第 15 课实现）：

| 模式 | 含义 | 典型场景 |
| --- | --- | --- |
| `emit` | 观察，不等待 | 状态通知 |
| `waterfall` | 包装/委托，可短路 | 请求改写、权限决策 |
| `parallel` | 扇出，并行 | 并发通知 |
| `serial` | 有序执行 | 生命周期钩子 |

为什么 `EVENT_MODES` 用 `Partial`？因为插件声明合并会扩展 `EventKind`，内核不可能预知新事件的模式——**插件要为自己的事件补充模式**。

## 5. 与 dsh 的对照

dsh 的 `SessionEventMap` 就是这么设计的：事件带 `@mode` 标签，文档由生成器从声明里产出（`docs/event-producer-consumer.md`），并校验"声明与分发点一致"。本课的 `TypedEventBus` 是它的最小实现。

## 小结

- 事件表 = 词汇表 + 编译期契约。
- 声明合并让插件扩展事件表而不改内核。
- `@mode` 是事件的调度契约，第 15 课兑现。

## 预习

- 一个事件同时被多个监听器监听时，顺序和返回值怎么定？（第 15 课四模式。）
