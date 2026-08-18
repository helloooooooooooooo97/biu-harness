# 34-capability-seam-3layers 讲义

## 目标

- 讲透**能力缝三角色**：Service Definition / Service Provider / Consumer。
- 合并本课的核心实操：**一切皆插件**——把 loop、工具、提示词、服务全部注册进 ctx，换实现不动消费者。
- 实现 `CapabilityRegistry`（按 key 寻址）与 `MiniContext`（插件组装）。

## 1. 能力缝三角色

一个可替换能力由三部分组成：

```text
Definition（定义）：接口 + key（"能力长什么样"）
Provider（实现）：满足 Definition 的具体类（"谁能干"）
Consumer（消费者）：只用 Definition 的代码（"谁用"）
```

```ts

const definition = { key: 'llm', description: '模型调用' }
class DeepSeekProvider implements ServiceProvider { ... }   // Provider
class LoopConsumer { constructor(private llm: LlmClient) {} } // Consumer 只认接口
```

**一个角色不构成缝**：只有"定义 + 多个 Provider + Consumer"都齐了，才是能力缝。换 Provider 时 Consumer 一行不改。

## 2. CapabilityRegistry：按 key 寻址

```ts
registry.register({ definition, create: () => new DeepSeek() })
registry.provide('llm')   // 懒创建实例
```

这就是 `ctx.llm` / `ctx.fs` 的形态：插件按 key 拿能力，不 import 实现。

## 3. 一切皆插件实操（本课核心）

把第 19-30 课的硬编码组件**逐个注册成插件**：

```ts
const ctx = new MiniContext()
ctx.plugin(toolsPlugin)      // 提供 tools 服务
ctx.plugin(promptPlugin)     // 提供 prompt section
ctx.plugin(loopPlugin)       // 提供 agentLoop 驱动

// 换 loop 实现：卸载旧插件、挂新插件，消费者（cli）代码不变
ctx.plugin(loopPluginV2)
```

验证方式：`ctx.get('tools')` / `ctx.get('agentLoop')` 按 key 取，`unload` 后服务消失。**"没有特权核心"从口号变成代码**：loop、工具、提示词、服务都是插件。

## 4. 一体化：插件装载能力

第 2 节的 `CapabilityRegistry`（能力层）和第 3 节的 `MiniContext`（组装层）是**拆开看**的两个职责。真实 dsh 里它们是一体的：**插件装载能力，能力保证可替换**。`CapabilityContext` 把两者合并：

```ts
const ctx = new CapabilityContext()
ctx.plugin({
  name: 'llm',
  apply(c) {
    c.mount({                                   // 能力缝：definition + create
      definition: { key: 'llm', description: '模型调用' },
      create: () => new DeepSeek(),
    })
  },
})
ctx.get('llm')   // 消费者按 key 取，懒创建 + 缓存
```

一体化后的三个保证：

- **懒创建 + 缓存**：`create()` 只跑一次（能力缝的寻址层）；
- **归属追踪**：插件卸载时清掉它 mount/provide 的一切（组装层的生命周期）；
- **可替换**：换 Provider = 卸载旧插件 + 挂新插件，消费者 `get(key)` 无感。

## 5. 与 dsh 的对照

dsh 的 fs/subprocess/llm/subagent 全部是能力缝：定义在 spine 包、Provider 各自成包、Consumer 是工具/loop。本课的 `CapabilityRegistry` + `MiniContext` 是它的教学版。

## 小结

- 能力缝 = Definition + Provider + Consumer，单角色不构成缝。
- 注册表按 key 寻址，换 Provider 不动 Consumer。
- 一切皆插件：loop/tools/prompt/service 都注册进 ctx，可插拔、可替换。

## 预习

- fs 和 subprocess 怎么一起换后端？（第 35 课。）
