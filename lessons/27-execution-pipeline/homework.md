# 27-execution-pipeline 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解七段流水线。
2. **pre 拒绝**：写测试——`onPre` 监听器返回 `{ allow: false, reason: '禁止' }`，断言 body **没有执行**、结果 `denied: true`。
3. **guard 单调**：写测试——`addGuard` 拒绝后，即使再注册一个"允许"的 guard 也不能撤销，结果仍是拒绝。
4. **post 改写**：写测试——`onPost` 把结果文本加上后缀，断言最终 `text` 被改写。
5. **回答问题**：为什么 guard 必须是单调的（不能从 deny 回到 allow）？如果安全策略能被后来的插件"放行"，会出什么问题？

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/27-execution-pipeline
cd lessons/27-execution-pipeline/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
