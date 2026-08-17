# 阶段 → 课程 → 代码 tag 对照表

| 阶段 | 课程范围 | 代码形态 | git tag |
| --- | --- | --- | --- |
| A-D | 01-17 | 每课独立可运行演示 + mini-Cordis 内核 | — |
| E | 18 | 进入 `project/`，pnpm workspace + 真实 cordis | `lesson-18` |
| E-L | 19-53 | `project/` 增量演进，`code/` 放补丁 | `lesson-19` … `lesson-53` |

## 从零到一：最终交付物 mini-dsh

课程终点是一个可用的 deepseek harness，沿途里程碑：

- **M1（第 08 课）** 单文件垂直切片：DeepSeek 调用 + 工具循环 + 流式 + mock 测试
- **M2（第 12 课）** 会话事件日志与重放
- **M3（第 17 课）** mini-Cordis 插件内核（生命周期 + 热重载）
- **M4（第 25 课）** 完整 agent loop 生命周期（agent/agent-loop）
- **M5（第 30 课）** 工具流水线（并发/重试/审批）
- **M6（第 32 课）** DeepSeek 真实适配器
- **M7（第 40 课）** CLI / Web / JSON-RPC / ACP 入口
- **M8（第 43 课）** 应用层插件化：Skills、UI 即插件、动态自指（agent 写组件热重载到前端）
- **M9（第 48 课）** 安全与韧性
- **M10（第 53 课）** 结业评测与复盘

贯穿全部课程的三条架构原则：

- **一切皆插件**：能力以插件形式注册进 cordis 内核（详见 [architecture.md](architecture.md)）。
- **可逆生命周期**：每个插件可注册 effect、可卸载、可热重载；改动插件或配置不重启进程。
- **mini 内核 → 真实 cordis**：13-17 课手写 mini-Cordis 理解机制，第 18 课换装真实 `@deepseek-ai/cordis`，业务层代码不变。

生产级补强（限流、成本预算、崩溃恢复、安全纵深、模型路由、打包部署、稳定性压测）以扩展课时/作业织入对应课，不改变主线。

> TODO：每周在 `project/` 打 tag 后，在此更新实际 tag 与 commit 对照。
