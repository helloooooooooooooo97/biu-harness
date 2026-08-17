# 14-services-and-inject 讲义

## 目标

- 把第 13 课的"手动 `ctx.get`"升级成**声明式依赖注入**：`deps: ['config', 'session']`。
- 用**拓扑排序**让加载顺序由依赖关系决定，而不是手工 boot 排序。
- 理解缺失依赖与循环依赖为什么必须"失败要响亮"。

## 1. 问题：插件 A 需要 B 的服务

第 13 课里 `promptPlugin` 用 `ctx.get('sections')` 拿服务——这是**手动取**：如果 `sectionsPlugin` 还没加载，直接抛"缺少服务"。顺序错了就崩，而且只有运行时才知道。

第 14 课改声明式：**服务声明自己依赖谁**，内核负责按依赖排序：

```ts
const defs: ServiceDef[] = [
  { name: 'config', create: () => ({ model: 'deepseek-chat' }) },
  { name: 'session', create: () => ({ id: 's1' }) },
  {
    name: 'agent-loop',
    deps: ['config', 'session'],          // 声明依赖
    create: (deps) => ({ model: deps.config.model, session: deps.session }),
  },
]
buildServices(ctx, defs)                   // 内核按拓扑顺序实例化
```

## 2. 拓扑排序（Kahn 算法）

`resolveOrder` 做三件事：

1. **校验依赖存在**：`deps` 里出现未定义的服务 → `缺少服务定义: xxx（被 yyy 依赖）`；
2. **计算入度 + 依赖者表**：入度为 0 的服务先排（没人依赖它）；
3. **逐层出队**：排一个，就把它依赖者的入度 -1，减到 0 再入队。

结束后如果还有服务没排到 → **循环依赖**（a 依赖 b、b 依赖 a），报错点名环里的服务。

为什么"失败要响亮"？因为依赖错了意味着**服务图本身不成立**——静默降级只会让运行时在更深处炸，而且更难查。

## 3. 注入而不是查找

`buildServices` 按拓扑顺序依次：

```ts
ctx.provide(name, def.create(deps))   // deps 是已解析好的依赖对象
```

服务**只拿到自己声明的依赖**，不拿整个 ctx——依赖关系显式、可测试、可替换。这正是 dsh 里 `inject` 字段的语义（第 08 课讲过 Definition/Provider/Consumer，这里是它落地到服务图）。

## 4. 与真实 cordis 的对照

cordis 插件声明 `inject: ['sessions', 'tools']`，Loader 等所有依赖就绪后才激活插件——**加载顺序通过服务需求表达，而不是手工 boot 排序**。本课的 `resolveOrder` 是它的最小实现；第 17 课会把它和配置加载接起来。

## 小结

- 声明依赖（`deps`），内核排序（拓扑），实例化注入。
- 缺失依赖和循环依赖都要响亮报错。
- 服务只看到自己的依赖，不看到整个世界。

## 预习

- 服务依赖解决了"加载顺序"，但"插件被谁启用/禁用"由什么决定？（第 17 课：配置驱动加载。）
