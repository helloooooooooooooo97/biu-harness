# DeepSeek Harness（dsh）框架问题与心智负担分析

> 基于仓库内 submodule `deepseek-harness/`（`dsh-v0.1.0-rc.7`）的源码、架构文档、事故复盘与工程约定整理。  
> 本文是外部观察与批评性梳理，不是上游官方立场。

---

## 1. 一句话结论

dsh 把「一切皆可替换」推到了极致：架构表达力很强，但**可组合性本身成了最大的产品**。对绝大多数想「接一个工具 / 换一个模型 / 改一点循环」的开发者来说，必须同时掌握 Cordis 运行时、三角色能力 seam、多层配置组装、会话日志不变量，以及一整套仓库级治理闸门——**认知前置成本远高于常见 agent 框架**。

---

## 2. 规模事实（心智负担的物理基础）

以下数字来自当前锁定的上游树，用来说明「不是感觉复杂，而是客观复杂」：

| 维度 | 量级 | 含义 |
| --- | --- | --- |
| 工作区包 | ~220+ `package.json` | 功能被拆到极细粒度；找「该改哪」本身就是导航问题 |
| `packages/` 分组 | 50+ 组（core / llm / shell / session / typert …） | 领域词表巨大，跨组依赖难一眼看清 |
| TypeScript 文件 | ~2.2k 个，约 **50 万行** | 单人无法靠通读建立全景 |
| 文档 Markdown | ~217 篇（另有大量 i18n / 生成目录） | 文档是「第二代码库」 |
| Agent Notes | ~2000+ | 决策历史极厚；权威分散在 note / AGENTS / 子系统页 |
| `package.json` scripts | **124** 个（其中 `verify-*` 约 38、`gen-*` 约 12） | 本地正确性依赖大量专用闸门 |
| AGENTS.md | 仓库多处合计 250+ 行硬规则 | 贡献路径被规则手册化 |
| Vendor Cordis 栈 | cordis / loader / include / hmr / schemastery … | 框架底座也是源码内嵌，问题可穿透到 vendor |

官方自己也写明：处于**开发者预览**，会有破坏性变更；并建议「用 agent 探索代码库理解架构」——这本身就是信号：**人类默认读不动**。

---

## 3. 核心设计带来的固有问题

### 3.1 「一切皆插件」把简单路径变长

产品没有特权内核：模型适配、工具注册、会话日志、**agent loop 本身**都是插件。优点是替换面大；代价是：

- **没有「改这一处就够了」的中心。** 新行为要挂到文档化的扩展点；改 loop 还要同步架构图。
- **行为由组装决定，不由源文件决定。** 同一段代码在不同 profile / bundle / patch / overlay 下可呈现完全不同的运行时。
- **调试从「看调用栈」变成「看 fiber 树 + 配置层叠」。** `dsh --dump-config` 几乎是必需品，而不是高级技巧。

对新手，这把「agent 框架」学成了「分布式插件操作系统」。

### 3.2 能力 seam 的三角色模型抬高最小改动成本

官方把可替换能力定义为完整 **seam**：

1. **Service Definition**（占 `ctx.<key>`）
2. **Service Provider**（实现）
3. **Consumer**（常见是面向模型的 tool）

理想上角色独立演进；现实上：

- 加一个能力经常意味着**拆包 + 命名角色 + 注入关系 + 事件域选择**；
- 包命名规则极细（Controller / Store / Registry / Runtime / Provider / Backend / Handle … 各有禁用场景）；
- 「只写一个 tool 函数」在 dsh 里往往不合法或不完整。

这是架构纯度换开发者效率的典型交易。

### 3.3 多层配置组装：profile → bundle → patch → home → CLI overlay

运行时不是「一个 `cordis.yml`」，而是有序叠层。要理解「机器上到底启动了什么」，必须重建整棵配置树。

额外陷阱来自 Cordis Loader 语义（已被事故复盘证实）：

- `!!js` **只在插件 `config` 内求值**；写在 `disabled` 等元数据上会被当成 truthy 对象，**静默错误**；
- 条件组合应走 overlay，而不是直觉上的「YAML 表达式到处可用」。

配置语言看起来像 YAML，实际是带求值边界的小型语言——**表面熟悉、语义陌生**。

### 3.4 事件域分裂：持久会话事件 vs 实时 agent 事件 vs 能力事件

扩展点首先要选对事件域：

- 会话事件：必须可重放 / 可持久化；
- `agent/*`：拦截进行中的工作；
- `fs/*`、`tools/*` 等：策略与适配，不碰 loop。

再叠加 dispatch 模式（`emit` / `waterfall` / `parallel` / `serial`），以及 waterfall **必须 `next()`**，否则短路。

结果是：一次「拦截工具执行」的改动，先要过一遍**事件分类学**。

### 3.5 「模型可见 ⟺ 已记录」把产品正确性绑死在日志模型上

架构硬约束：抵达模型的一切都必须能从 session log 重建。这意味着：

- 新增模型可见输入 ⇒ 扩 `SessionEventMap` + 投影 / 回放 / SDK 期望输出；
- TypeScript / Python SDK 的 snapshot 往往要同 PR 更新；
- 局部功能改动容易触发**跨包契约连锁**。

正确性强，但**局部改动的爆炸半径大**。

### 3.6 Cordis 运行时细节会「穿透」到业务正确性

事故复盘展示了典型失败模式：

| 案例 | 表面现象 | 真实机制 |
| --- | --- | --- |
| ACP `export default apply` | `cannot get property "agents" without inject` | Loader `unwrapExports` 偏好 `.default`，丢掉同级 `inject` |
| `!!js` 写在 `disabled` | 文件系统工具永久消失 | 元数据不插值，表达式对象恒 truthy |
| 可选服务 + shadow / inject 守卫 | 另一条路径同样报 inject 错误 | 测试用手挂载绕过了真实 Loader |

共同模式：**单元测试 100% 仍可放过集成路径缺陷**。框架把正确性推到「必须按 Cordis 真实加载方式验证」，心智上等于要求每个贡献者理解 vendor Loader / fiber / shadow。

---

## 4. 工程与流程上的心智税

### 4.1 贡献清单过重

新增一个 workspace 包的 cookbook 要求大致包括：

- 固定的 `package.json` / `tsconfig` / exports / peer+dev 双写 `@deepseek-ai/cordis`；
- 挂到 host 或 client 的 tsconfig aggregate；
- README 强制 **Model Experience**（模型看到什么、token 影响、KV Cache 影响）与 **Known Limitations**；
- 非琐碎改动必须同 PR 写 **Agent Note**；
- 行为变更常要补 **keyless snapshot**（且不能用纯 mock 顶替）；
- 双语文档配对、生成目录 freshness、`doc-sync` 等闸门。

这些规则单独看都「有道理」（防漂移、防假绿、防模型体验遗忘），合在一起则是：**改一行行为，可能要动代码 + note + 中英文档 + 生成物 + snapshot**。

### 4.2 「闸门驱动开发」替代了「直觉驱动开发」

仓库用大量 `verify-*` / `gen-*` 把约定机器化：配置所有权、导出 JSDoc、包不变量、Cordis 配置、文档预算、翻译配对、模块图……

好处：大规模协作不易腐化。  
坏处：

- 新人必须先学会**闸门语言**，才能知道什么叫「做完了」；
- 失败信息常指向「约定系统」，而非业务语义；
- 本地默认不跑全套（AGENTS 也劝阻），但真正合并仍依赖一整座 CI 矩阵——**责任边界模糊**。

### 4.3 覆盖率与正确性被混谈的风险

CI 对 `packages/*/*/src` 追求 **per-file 100%**。官方也承认：行覆盖只证明行跑过，不证明功能按发布形态工作。ACP 事故正是「178 个绿测 + 100% 覆盖仍生产不可用」。

于是出现双重负担：既要喂饱覆盖率闸门，又不能信任它——贡献者必须**额外**记住「真实 Loader / 真实 entry / snapshot」才是安全网。

### 4.4 语言与运行时门槛偏高

- Node：`^22.19 || >=24`
- 包管理：`pnpm@11`
- 全面 ESM + NodeNext 风格路径约定
- Host / Client 双 face 编译平面，禁止混用
- 源码启动依赖 `tsx` ESM hook

环境一不对，问题会表现为晦涩的模块解析 / 构建 face 错误，而不是业务断言失败。

### 4.5 文档与权威的碎片化

权威分散在：

- `docs/architecture.md` / 子系统页 / cookbook
- 根与分包 `AGENTS.md`
- `.agents/notes/`（现行）与 archived notes（明确「不得当现行权威」）
- 生成目录（tool / config / event / module graph）
- postmortem（失败教训）

「该信哪份」本身需要元认知。官方用预算、配对、分类规则压制漂移，但也把**读文档的策略**变成了技能。

---

## 5. 心智负担拆解（按角色）

### 5.1 终端用户 / 试用者

相对最轻：`npx @deepseek-ai/dsh web` 可启动。但仍需理解 profile、凭据、权限预设、沙箱边界。预览阶段 API 不稳会放大「跟着文档做却踩坑」的体验。

### 5.2 插件作者（想扩展，不想改内核）

负担中高。最低限度要懂：

1. Cordis 插件形态（`name` / `inject` / `apply` / `Config`，且小心 default export）  
2. 该挂 service、tool、event 还是 patch  
3. 作用域（global vs `agent.ctx`）与生命周期清理  
4. 若影响模型可见面：session 事件与 prompt / schema 注册  

「写个 Claude Code 式 hook」在概念上简单，在 dsh 里常要落到正确 seam 与配置层。

### 5.3 能力提供方（sandbox / fs / shell / llm provider）

负担高。必须设计完整 seam，理解执行世界一致性（例如 fs 与 subprocess 要指向同一执行域），并处理权限、审批、遥测、持久化投影等旁路。

### 5.4 核心维护者 / 深度贡献者

负担极高。除上述全部外，还要：

- vendor Cordis 语义与本地 patch
- Host/Client、Typert、SDK 双端投影
- snapshot / e2e / hygiene / doc-sync 矩阵
- 命名与角色分类学、不变量断言风格
- 预发布立场下「可随意破坏兼容」与「全仓同步更新」的纪律

这更像在维护一个**小型操作系统 + 语言运行时 + 文档编译器**，而不是一个应用框架。

---

## 6. 问题清单（按严重度归纳）

### P0 — 结构性

1. **概念栈过深**：Cordis + seam 三角色 + profile/bundle + 三事件域 + session 不变量，缺一不可。  
2. **组装态真相**：行为真相在配置叠层，不在单文件；认知模型与目录结构错位。  
3. **框架泄漏**：Loader / inject / shadow / waterfall 细节直接决定产品 bug 形态。

### P1 — 工程体验

4. **改动爆炸半径**：模型可见、SDK、snapshot、双语文档、生成目录常被连带。  
5. **闸门过密**：正确性外包给几十个 verify；学习曲线陡，反馈偏「合规」而非「意图」。  
6. **测试假安全感**：高覆盖率 + 手挂载测试可系统性漏过真实启动路径。

### P2 — 演进与生态

7. **预发布破坏承诺**：外部插件与配置的长期成本不确定。  
8. **包爆炸**：220+ 包利于内部清晰，却抬高外部导航与版本心智。  
9. **词表过重**：turn / step / round / goal / Ralph / scope / lineage / seam … 新概念密度高，易混用。

---

## 7. 公平地说：这些问题换来了什么

批评需要对照收益，否则只是「复杂所以不好」：

- **替换粒度极细**：换 sandbox、换 LLM、换 loop、换 UI 节点都有显式挂点。  
- **可逆注册**：`effect` / unload 语义对 HMR 与动态组装友好。  
- **会话日志中心化**：回放、fork、遥测、UI、模型历史共用一个真相源。  
- **约定机器化**：在超大 monorepo 里用闸门维持一致性，比纯人工 review 更可扩展。  
- **失败可追溯**：postmortem + Agent Note 文化让「为什么这样」有档案。

因此 dsh 更像 **给 harness 构建者用的平台**，而不是给「三天内做一个 coding agent」的应用脚手架。若目标是后者，心智负担会显得不成比例。

---

## 8. 对「优化 / 降负担」的启示（面向本仓库）

若本分支（`dlh-optimization`）的目标是降低使用与演进成本，可优先考虑的方向：

1. **分层 API 表面**：保留 Cordis 内核，但对「加 tool / 加 provider / 改 prompt」提供更短的黄金路径与更少必懂概念。  
2. **配置语义显性化**：避免「看起来能写、实际不求值」的坑；失败要响、要早（上游已在补 `verify-cordis-config`，可继续产品化）。  
3. **测试金字塔纠偏**：强制「真实 Loader 启动」作为扩展点的默认模板，弱化对手挂载绿测的信任。  
4. **包与文档的信息架构**：按任务导航（我想做什么），而不是按内部包拓扑导航。  
5. **区分平台用户与平台维护者**：两套文档与两套约束；不要让外部插件作者承担完整 hygiene 宇宙。  
6. **稳定核心契约**：即使整体预发布，也应对 `ctx.tools` / session 事件 / 常用 waterfall 给出明确兼容层，降低插件作者的恐惧税。

---

## 9. 总评

| 维度 | 评价 |
| --- | --- |
| 架构野心 | 很高：时空可组合、一切可替换 |
| 表达力 | 很强 |
| 上手成本 | 很高 |
| 日常扩展成本 | 中高到高（取决于是否触及模型可见面） |
| 维护成本 | 极高（闸门 + 双语 + 生成物 + 双 SDK） |
| 主要风险 | 复杂性自我繁殖：为防复杂出错，再建更多规则与闸门 |

**心智负担的本质**不是某一篇文档难读，而是：开发者必须同时扮演「插件作者 + 配置编排者 + Cordis 运行时专家 + 文档/闸门合规官」。任何优化若只删功能不压缩概念面，负担不会真正下降；若只加文档不提供更短路径，负担只会换一种形态存在。

---

## 参考（仓库内）

- `deepseek-harness/README.zh.md` — 定位与预览声明  
- `deepseek-harness/docs/architecture.zh.md` — 架构主文档  
- `deepseek-harness/docs/cordis-primer.md` — Cordis 五概念与 waterfall / `!!js`  
- `deepseek-harness/docs/glossary.md` — 领域词表  
- `deepseek-harness/docs/cookbook/adding-a-package.md` — 加包全清单  
- `deepseek-harness/docs/postmortem/` — 尤其 0001、0002  
- `deepseek-harness/AGENTS.md` — 贡献硬规则与闸门文化  
