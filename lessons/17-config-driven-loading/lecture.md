# 17-config-driven-loading 讲义

## 目标

- 用**配置文件**决定加载哪些插件，而不是在代码里 `ctx.plugin(...)` 一个个写死。
- 实现**配置热重载**：配置变更 → 卸载旧树 → 挂新树，失败回滚到上一个稳定树。
- 理解"配置即代码之外的另一条事实源"：插件树由配置表达，可审计、可覆盖。

## 1. 为什么配置驱动

第 13-16 课加载插件都是写死的：

```ts
ctx.plugin(sectionsPlugin)
ctx.plugin(toolsPlugin)
```

问题：换一套组合要改代码、要重新构建。第 17 课把"装哪些插件"外置到配置：

```json
{
  "entries": [
    { "id": "tools", "name": "tools", "enabled": true },
    { "id": "prompt", "name": "prompt" },
    { "id": "logger", "name": "logger", "enabled": false }
  ]
}
```

插件树 = 配置的**投影**。想禁用 logger？改一行配置，热重载生效。

## 2. ConfigLoader：装载与回滚

```ts
const loader = new ConfigLoader({ registry: BUILTIN_PLUGINS })
loader.applyConfig(configText)   // 解析 → 卸载旧树 → 挂新树
```

`replaceTree` 的五段式（和第 16 课 reload 同一个思想，但作用在整棵树）：

```text
1. 记住当前配置（previous）
2. 快照状态
3. 卸载整棵旧树
4. 挂新树
   ├─ 成功 → 更新 currentEntries
   └─ 失败（未知插件/apply 抛错）→ 卸载半挂新树 → 恢复状态 → 重挂旧树 → 抛出原错误
```

配置里出现**未知插件名**必须响亮失败，并且**系统保持上一个可用树**——不能带着半棵树继续跑。

## 3. ConfigWatcher：配置热重载

```ts
const watcher = new ConfigWatcher(loader)
watcher.subscribe(() => console.log('插件树已更新'), (err) => console.error('更新失败，保留旧树'))
watcher.push(newConfigText)   // 模拟文件变更
```

真实 dsh 里这一步是 `watchUserPatches`：监听 `cordis.patch.yml` 变更 → 事务性重算 patch 层 → 失败广播 `hmr/config-update-failed` 并保留上一个可用树。本课的 `push` 是它的教学版（测试友好）；换成 chokidar 文件监听是扩展课时。

## 4. 与 dsh 的对照

dsh 的配置层更丰富：`cordis.yml`（include/group、`!!js` 表达式）、profile/bundle/patch 分层、`--patch` 覆盖（第 37 课）。本课是最小闭环：**配置 → 解析 → 装载 → 热重载 → 回滚**——之后的 36-37 课会把表达式和分层加回来。

## 小结

- 插件树 = 配置的投影，组合不写死在代码里。
- 热重载整棵树：卸载 → 挂载，失败回滚到上一个稳定树。
- 未知插件/坏配置要响亮失败，且不破坏现有运行。

## 预习

- 两个插件互相依赖时，配置里的顺序重要吗？（第 14 课拓扑排序：依赖声明接管顺序。）
