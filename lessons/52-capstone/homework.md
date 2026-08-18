# 52-capstone 作业

## 作业

1. **选题**：三选一，写一页"项目说明"（做什么、为什么、技术选型）。
2. **实现**：基于 `capstone-starter.ts` 或 `project/` 完成项目。
3. **测试**：至少 3 个测试覆盖关键路径。
4. **文档**：README（运行方式 + 架构图）。
5. **演示**：准备一个 1 分钟的演示脚本（输入什么、期望什么输出）。

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/52-capstone
cd lessons/52-capstone/code && npm test
```

- starter 能跑通：JSON-RPC `run` 返回 mock 回答；工具可用。
- 你的项目满足三条通用验收（能跑/有测试/有文档）。
