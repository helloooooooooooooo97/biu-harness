# DeepSeek Harness（dsh）面向对象设计（OOD）分析

> 基于 `deepseek-harness/`（`dsh-v0.1.0-rc.7`）源码与架构文档。  
> 与 [框架问题与心智负担分析](./dsh-framework-problems-and-cognitive-load.md) 互补：前文偏「用起来有多累」，本文偏「对象怎么切、SOLID 表现如何」。

---

## 1. 总评

dsh **不是**经典「深继承领域模型」的 OOP，而是：

> **Cordis 插件图 + 浅继承 `Service` + 接口契约 + 声明合并（declaration merging）拼出的全局对象图。**

横向扩展（加 tool / provider / adapter）的 OOD 质量高；纵向修改（动 loop、tools 管线、session 不变式）成本高。可维护性瓶颈不在继承树，而在 **隐式服务图与少数 God Service**。

---

## 2. 对象模型长什么样

### 2.1 唯一稳定的继承轴：`Service`

Cordis 基类几乎是全仓唯一「框架级超类」：

```11:58:deepseek-harness/vendor/cordis/src/service.ts
export abstract class Service<out T = never> {
  // ...
  constructor(protected ctx: Context, name: string) {
    // ...
    self.ctx.reflect.provide(name, self, this[symbols.check])
    return self
  }
}
```

子类 `super(ctx, 'tools' | 'shell' | …)` 即注册为 `ctx.<key>`，随 fiber 卸载自动注销。  
粗估：`packages/**/src` 内约 **18** 个 `abstract class … extends Service`（能力定义），约 **47** 个具体 `Service` 实现，约 **93** 处 `declare module '@deepseek-ai/cordis'`。

**含义：** OO 继承很浅（通常 ≤ 2 层），复杂度转移到「谁 provide 了哪个键」。

### 2.2 领域对象：接口 + 组合，而非继承树

| 概念 | 形态 | 代表路径 | 规模 |
| --- | --- | --- | --- |
| `Agent` | **interface**（富句柄） | `packages/core/agent/src/runtime-types.ts` | 接口清晰 |
| `AgentRegistry` | `extends Service` | `packages/core/agent/src/index.ts` | ~706 行 |
| `AgentLoop` / `ReactLoopAgent` | Service 工厂 + `implements Agent` | `packages/core/agent-loop/src/` | ~713 + ~496 行 |
| `Session` / `SessionStore` | 富对象 + Service | `packages/core/session/src/index.ts` | ~1157 行 |
| `ToolRuntime` | `extends Service` | `packages/core/tools/src/index.ts` | **~1946 行** |
| `ShellExecutor` | **abstract Service**（seam 定义） | `packages/shell/shell/src/index.ts` | ~103 行（健康） |
| `LlmRuntime` / `LlmAdapter` | Service + 策略抽象 | `packages/llm/llm/src/` | Runtime ~947 行 |
| Scope | **函数式 API**，无类树 | `packages/core/scope/src/` | ~204 行 |

典型产品继承链：`Service ← ShellExecutor ← LocalBashExecutor`（sandbox 再包一层）。**深继承不是问题。**

### 2.3 「隐式 OO」：声明合并 = 分布式类图

```ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    shell: ShellExecutor
    tools: ToolRuntime
    agents: AgentRegistry
    // … 全仓合并出肥 Context
  }
}
```

再加上 `Events` / `SessionEventMap` 的 merge-extensible 地图：完整「对象模型」不在一张类图里，而在 **合并后的全局 `Context` + 事件表**。IDE 能跳转，人脑难以一次装下。

---

## 3. 实际使用的设计模式

| 模式 | 在 dsh 中的落点 | OOD 评价 |
| --- | --- | --- |
| Plugin | 一切皆 Cordis 插件；profile/bundle 叠层 | 扩展面大，真相在组装态 |
| Registry | agents / tools / llm adapters / prompt sections | 经典且清晰 |
| Capability Seam（Definition / Provider / Consumer） | shell 三包是范本 | 包级 SRP 好，最小改动成本高 |
| Waterfall Middleware | `agent/pre-step`、`tools/*-execute`、`llm/stream` | 开放封闭好；必须懂 `next()` |
| Effect / Disposer | `ctx.effect` / `ctx.on` | 生命周期一等，优于手写单例 |
| Factory + Strategy | `AgentRegistry.setFactory` ← `AgentLoop`；`LlmAdapter.stream` | 驱动可替换 |
| Branded ID | `SessionId`、`CallId` 等 | 类型层防混用，好 |
| Scoped Dispatch | `scopeTarget` 作事件 `thisArg` | 有意的 Demeter 防护 |
| Ambient Context（ALS） | `withInitiator` | 强大但隐式，易误用 |

---

## 4. SOLID 对照

### 4.1 SRP（单一职责）

| 层级 | 表现 |
| --- | --- |
| **包 / seam** | 较好：session、tools、agent、shell、llm 边界清楚 |
| **类** | 两极分化：`ShellExecutor` 很纯；`ToolRuntime` / 大 `Session` 文件接近 God Object |

`ToolRuntime` 同时负责：注册与 shadow、restrict/guard、scoped layers、native/code/both 呈现、`run_code` 传输、waterfall 执行、并行调度后门、与 `systemPrompt` 接线——**一个类吃掉整条工具子系统**。

```787:837:deepseek-harness/packages/core/tools/src/index.ts
export class ToolRuntime extends Service {
  static inject = ['systemPrompt']
  readonly [TOOL_RUNTIME_SCHEDULER]: ToolRuntimeScheduler = { /* ... */ }
  // WeakMaps × 多个执行态、ScopedLayers、codeTransport …
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'tools')
    ctx.systemPrompt.tools(context => this.wireSchemas(context.scope))
    // ...
  }
}
```

### 4.2 OCP（开放封闭）

**对扩展开放度很高**：加工具、换 LLM、换 shell、拦 waterfall、扩 session 事件，通常不必改 `agent-loop` 源码。

**封闭的代价：**

- 新能力要做完 Definition + Provider + Consumer；
- 「模型可见 ⟺ 已记录」强制扩 `SessionEventMap` + 投影/SDK；
- 扩展走配置叠层与事件，而不是子类钩子——**OCP 成立，但学习面是事件地图而非虚方法表**。

### 4.3 LSP（里氏替换）

继承浅，经典 LSP 破坏少见。真正的替换契约在 **Service Provider 语义**：

- 同键第二份 provider 会因 Cordis 重复注册失败（有意）；
- `ShellExecutor.run` 约定：非零退出 / timeout **resolve 不 reject**——违反则工具层假设破裂；
- `Agent` 可任意实现，但创建/销毁时序由 Registry/Loop 强约束。

这是 **契约替换**，不是继承替换；文档不全时，替换者容易踩雷。

### 4.4 ISP（接口隔离）

- **领域接口相对克制**：`Agent`、`ShellExecutor` 方法面不肥。  
- **`Context` 是肥接口**：全局合并出大量 `ctx.*`；消费者常 `import type {} from '…'` 只为触发 augmentation。  
- 违反 ISP 的主要是 **框架入口 `ctx`**，不是单个领域 API。

### 4.5 DIP（依赖倒置）

**好的一面：** UI/ACP 依赖 `ctx.agents` + `Agent`，不直接依赖 `ReactLoopAgent`；工具依赖 `ShellExecutor` 抽象。

**弱的一面：** 大量代码依赖具体 **键名与 Cordis 事件模式**；`ReactLoopAgent` 热路径直接摸 `loopCtx.systemPrompt` / `llm` / `agents`。抽象是「框架服务」，不是纯领域 Port——**DIP 止于 Cordis 边界**。

---

## 5. 其他经典 OOD 关切

### 耦合与内聚

- **包间**：编译期靠类型 augmentation「松」，概念期靠全局事件/键「紧」。  
- **内聚**：registry 包高；`tools/index.ts` 把注册视图 + 执行管线 + code-mode 揉在一起，内聚下降。  
- **Demeter**：`agent.session.append`、`loopCtx.llm.stream` 常见；scope carrier 是刻意防护。  
- **封装后门**：`TOOL_RUNTIME_SCHEDULER` symbol 让 loop 伸进 tools 内部调度——实用，但破坏边界。

### 贫血 vs 充血

混合模型，且大多有意：

- **充血**：`Session`（校验/surface/fork）、`ReactLoopAgent`（相位状态机）、`ToolRuntime`（执行管线）。  
- **贫血**：可序列化的 `SessionEvent` / message DTO——日志真源需要可投影、可回放。

### 抽象泄漏

`Agent.ctx: Context`、`Scoped<T>`、`ctx.effect` 直接出现在领域 API。  
选择很明确：**把 DI/生命周期当一等公民**，不在领域层再包一层 Port。代价是新人必须先学 Cordis，才能读懂「对象」。

### 对象图难推理

Profile → bundle → patch → 运行时 fiber 树；Agent 创建还有 unpublished setup → 双注册 → 事件 → loop start 的精密时序。  
类图帮不上忙，必须靠 `--dump-config`、capability 图谱与生命周期文档。

---

## 6. 代码异味清单（按优先级）

### P0

1. **`ToolRuntime` God Service（~1946 行）** — 最高优先级拆分候选：注册视图 / 执行管线 / code-mode 呈现。  
2. **肥 `Context` + 声明合并** — 完整对象模型分布式存在，导航与重构成本高。  
3. **Cordis 泄漏进领域** — `Agent.ctx` 等让「纯 OO 领域层」不存在。

### P1

4. **`Session` 大文件（~1157 行）** — 校验、restore、surface、fork、flush 可分包。  
5. **`AgentLoop` 过重（~713 行）** — 工厂、ownership、teardown、persistence 事务纠缠。  
6. **符号后门调度器** — loop↔tools 隐式耦合。  
7. **ALS initiator** — 隐式授权上下文，调用链难静态分析。

### P2

8. 配置对象图与插件元数据（`inject` / default export）细节决定运行时正确性——属于框架 OO，却落在业务失败模式上（见 postmortem 0001）。  
9. 包爆炸（220+）在「类职责」上局部很好，在「找对象」上整体很差。

---

## 7. 健康范本：Shell Seam

对比 God Service，shell 是 OOD 做得好的样本：

```65:101:deepseek-harness/packages/shell/shell/src/index.ts
export abstract class ShellExecutor extends Service {
  constructor(ctx: Context) {
    super(ctx, 'shell')
  }
  abstract resolve(request: ShellExecRequest): ShellExecSpec
  abstract run(spec: ShellExecSpec): Promise<ShellRunResult>
  abstract start(spec: ShellExecSpec): ShellProcess
}
```

- Definition 极薄、契约写进 JSDoc；  
- Provider / Consumer 分包；  
- `resolve` 与 `run` 分离（显式默认，而非藏在 `run` 里的 `??`）；  
- 替换语义清晰（一上下文一份 `ctx.shell`）。

**优化启示：** 核心子系统应按 shell 的 seam 厚度重构，而不是按「再加一层继承」。

---

## 8. 对可维护性与心智负担的含义

| 场景 | OOD 评分 | 原因 |
| --- | --- | --- |
| 加 provider / tool / adapter | 高 | seam + registry + waterfall |
| 理解「系统里有哪些对象」 | 低 | 对象图在 merge 后的 `ctx`/事件上 |
| 改 tools / session / loop | 低–中 | megaclass + 强不变式 + 跨 SDK |
| 用经典 UML 类图沟通 | 不适用 | 真实结构是插件图，不是继承树 |

**一句话：**  
dsh 的 OOD 是 **framework-centric modular design**——用 Service/Registry/Event 代替经典领域继承。SOLID 在「包与 seam」层表现好，在「单个核心 Service 类」层常牺牲 SRP，以换取运行时一致性与可替换性。

---

## 9. 若做 OOD 向重构，建议顺序

1. **拆 `ToolRuntime`**：Registry（可见性/shadow/restrict）↔ Pipeline（prepare/dispatch/finalize）↔ Presentation（native/code/both）。保留 `ctx.tools` 外观，内部组合。  
2. **给肥 `Context` 做「逻辑子系统门面」文档/生成 API**：按任务暴露窄接口，而不是让人面对全键面。  
3. **收紧领域泄漏面**：对外 SDK/`Agent` 公共方法尽量不强迫调用方理解 fiber；内部仍可用 `ctx`。  
4. **消灭或显式化后门**：`TOOL_RUNTIME_SCHEDULER` 升级为正式、有文档的协作接口。  
5. **以 shell seam 为模板**审计 fs / subprocess / llm / subagent：Definition 是否过胖、Consumer 是否越权。

这些改动直接降低「心智负担分析」里说的概念税：**不是删功能，而是让对象边界重新可读。**

---

## 参考

- `deepseek-harness/vendor/cordis/src/service.ts` — Service 基类  
- `deepseek-harness/packages/shell/shell/src/index.ts` — 健康 seam  
- `deepseek-harness/packages/core/tools/src/index.ts` — God Service 样本  
- `deepseek-harness/packages/core/agent/src/runtime-types.ts` — `Agent` 接口  
- `deepseek-harness/docs/architecture.md` / `docs/glossary.md` / `docs/capability-seams.md`  
- 姊妹篇：[dsh-framework-problems-and-cognitive-load.md](./dsh-framework-problems-and-cognitive-load.md)
