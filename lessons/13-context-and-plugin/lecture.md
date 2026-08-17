# 13-context-and-plugin 讲义

## 目标

- 亲手实现 mini-Cordis 内核的第一版：**Context**（服务注册 + 可逆 effect + 插件加载）。
- 把"一切皆插件"从口号变成能跑的代码：sections / tools / prompt / ui 全是插件。
- 理解"注册即可逆"：插件卸载时，它注册的一切都被逆序撤销。

## 1. Context 是什么

第 08 课用 `LlmClient` 接口做了接缝；第 13 课把它推广成**整个内核**：一个 `Context` 对象同时是：

- **服务仓库**：`ctx.provide(name, impl)` / `ctx.get(name)`；
- **effect 记账本**：每次注册都留下可逆的清理函数；
- **插件加载器**：`ctx.plugin(def)` 把插件的注册纳入自己的作用域。

```ts
const ctx = new Context()
ctx.provide('greeting', 'hello')
ctx.get<string>('greeting')          // 'hello'
ctx.stop()                           // 全部逆序清理
```

## 2. 可逆 effect

```ts
ctx.effect(() => { /* 清理逻辑 */ })
```

设计要点：

- 每个 effect 都记账（放进数组），卸载时**逆序执行**；
- `effect()` 返回手动卸载器，重复调用只执行一次；
- `provide` 内部就是"注册 + 自动挂一个删除服务的 effect"——所以 `stop()` 能清空一切。

## 3. 插件加载与作用域

```ts
ctx.plugin({
  name: 'prompt',
  apply(ctx) {
    const sections = ctx.get<string[]>('sections')
    sections.push('- 可用工具：...')
    return () => { /* 移除自己贡献的 section */ }
  },
})
```

关键机制：**apply 执行期间注册的所有 effect 都被记入该插件的"作用域区间"**。卸载时：

1. 逆序执行该区间内注册的 effect（比如 `provide` 挂的删除器）；
2. 再执行 apply 返回的额外清理函数；
3. 卸载"依赖它的插件"（后加载的）先于它本身。

这就是热重载的地基（第 16 课正式做）：**卸载 = 撤销该插件的一切痕迹，不留悬挂引用**。

## 4. 外部 effect 与插件内 effect

内核里的 effect 分两类，**归属不同、清理边界不同**：

| | 外部 effect | 插件内 effect |
| --- | --- | --- |
| 注册时机 | 插件 apply 之外（直接 `ctx.effect()` / `ctx.provide()`） | 插件 apply 执行期间 |
| 记账 | 只进全局 effects 数组 | 记在该插件名下（`pluginEffects`） |
| 谁清理 | 手动 disposer 或 `stop()` | 只随该插件 `unload`（逆序 + cleanup） |
| 卸载别的插件 | 不受影响 | 不受影响 |

关键机制：`plugin()` 在 apply 之前把 `currentPlugin` 指向插件名，**apply 期间所有 `effect()` 调用都记进该插件的账本**；apply 结束恢复。所以：

- `unload('p')` 只清 p 账本里的 effect + p 的 cleanup，**不碰外部 effect、也不碰别的插件**；
- `stop()` 是两段式：先逆序卸载全部插件（各清各的），再清理残余的外部 effect。

为什么不能混在一起？因为"注册即可逆"承诺的是**精确撤销**：插件 A 卸载时绝不能顺带执行 B 或外部注册的清理函数——那会造成引用悬挂或重复执行。外部 effect 属于 context 本身，只在 context 停止时收尾。

> 实现细节：早期版本用"effect 数组下标区间"划分插件作用域，会把插件之后注册的外部 effect 一起扫掉。本课代码改为显式归属（`currentPlugin` + `pluginEffects` 账本），并配了回归测试。

## 5. 一切皆插件的最小组装

```ts
// app.ts
export function createMiniApp(): Context {
  const ctx = new Context()
  ctx.plugin(sectionsPlugin)   // 提供 sections 服务
  ctx.plugin(toolsPlugin)      // 提供工具注册表服务
  ctx.plugin(promptPlugin)     // 往 sections 注册提示词
  ctx.plugin(uiPlugin)         // 提供 UI 组件注册表服务
  return ctx
}
```

没有"核心业务类"——sections 是插件提供的服务，tools 是插件，prompt 是插件，ui 也是插件。想换提示词？卸载 prompt 换一个。想加工具？`tools.register(...)` 走的是服务接口。

## 6. 与真实 cordis 的对照

真实 `@deepseek-ai/cordis` 的 `ctx` 就是这个 Context 的完整版：`ctx.provide` / `ctx.effect` / `ctx.plugin` 同名同义，服务按 key 取、注册即可逆、插件树按依赖加载。第 18 课换装真实 cordis 时，本课写的代码概念全部直接映射。

## 小结

- Context = 服务仓库 + effect 记账本 + 插件加载器。
- 注册即可逆：卸载插件 = 撤销它的一切。
- 一切皆插件：内核只提供"怎么注册"，不提供"注册什么"。

## 预习

- 插件 A 依赖插件 B 的服务，加载顺序怎么保证？（第 14 课：inject + 拓扑排序。）
