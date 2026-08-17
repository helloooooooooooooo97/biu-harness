# 16-effects-and-teardown 讲义

## 目标

- 把第 13 课的"可逆 effect"独立成组件：注册、卸载、整体释放。
- 实现**热重载**：卸载旧插件 → 挂新插件，进程不重启。
- 理解"**状态与 effect 分离**"：重载只重建行为，不丢数据；失败可回滚。

## 1. EffectRegistry：记账本独立成件

第 13 课里 effect 记账是 `Context` 的内部数组；第 16 课把它抽成独立的 `EffectRegistry`：

```ts
const registry = new EffectRegistry()
const off = registry.register(() => console.log('清理'))
off()              // 手动卸载（幂等：重复调用只执行一次）
registry.disposeAll()  // 逆序释放全部（stop 时用）
```

三个不变量（测试锁住）：

- **注册即可逆**：每个 `register` 返回 disposer；
- **幂等**：disposer 重复调用只执行一次；
- **逆序释放**：`disposeAll` 从后往前——后注册的（可能依赖先注册的）先清理。

## 2. PluginHost：插件的热重载

```ts
const host = new PluginHost()
host.load({ name: 'greeting', apply(ctx) { ctx.provide('greeting', 'hello') } })
host.reload('greeting', { name: 'greeting', apply(ctx) { ctx.provide('greeting', 'hi') } })
```

`reload` 的三段式（对应 dsh 的 HMR 语义）：

```text
1. 快照当前状态（StateStore.snapshot）
2. 卸载旧插件树（逆序执行它的 effect + cleanup）
3. 加载新插件树
   ├─ 成功 → 返回新版本号
   └─ 失败 → 卸载半挂的新树 → 恢复状态快照 → 重新加载旧树 → 返回错误
```

这保证：**重载失败时，系统回到上一个稳定状态**，而不是带着半棵坏树继续跑。

## 3. 状态与 effect 分离

热重载最大的坑：插件内部闭包变量会在卸载时一起消失。解决办法是**状态放外面，行为放 effect 里**：

```ts
// ❌ 状态藏在 effect 里：重载后丢失
ctx.effect(() => { const count = 0; ... })

// ✅ 状态放 StateStore，重载只换行为
ctx.state.set('count', 0)
ctx.effect(() => { /* 读取 ctx.state 的行为 */ })
```

`StateStore` 提供 `set/get/snapshot/restore`——重载前快照、失败时恢复，就是第 12 课"快照/重放"思想在运行时生命周期上的应用。

## 4. 与 dsh 的对照

dsh vendored `@cordisjs/plugin-hmr`：监听文件 → 追踪模块图 → 只重载受影响插件；框架级依赖变更回退为 `loader.exit()` 重启。本课的 `PluginHost.reload` 是它的教学版：单插件替换 + 快照回滚。

## 小结

- effect 三不变量：可逆、幂等、逆序。
- 热重载 = 快照 → 卸载 → 加载 →（失败）回滚。
- 状态与 effect 分离：重载丢行为不丢数据。

## 预习

- 配置文件变了怎么触发 reload？（第 17 课：配置驱动加载。）
