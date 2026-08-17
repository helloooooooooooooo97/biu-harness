# 阶段 → 课程 → 代码 tag 对照表

| 阶段 | 课程范围 | 代码形态 | git tag |
| --- | --- | --- | --- |
| A-D | 01-17 | 每课独立可运行演示 | — |
| E | 18 | 进入 `project/`，workspace 初始化 | `lesson-18` |
| E-K | 19-50 | `project/` 增量演进，`code/` 放补丁 | `lesson-19` … `lesson-50` |

## 从零到一：最终交付物 mini-dsh

课程终点是一个可用的 deepseek harness。沿途里程碑：

- **M1（第 08 课）** 单文件垂直切片：DeepSeek 调用 + 工具循环 + 流式 + mock 测试
- **M2（第 12 课）** 会话事件日志与重放
- **M3（第 17 课）** mini-Cordis 插件内核
- **M4（第 25 课）** 完整 agent loop 生命周期
- **M5（第 30 课）** 工具流水线（并发/重试/审批）
- **M6（第 32 课）** DeepSeek 真实适配器
- **M7（第 40 课）** CLI / Web / JSON-RPC 入口
- **M8（第 45 课）** 安全与韧性
- **M9（第 50 课）** 结业评测与复盘

> TODO：每周在 `project/` 打 tag 后，在此更新实际 tag 与 commit 对照。
