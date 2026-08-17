# 09-session-event-log 作业

## 作业

1. **写事件流**：用 `SessionLog` 记录一个完整回合（user → assistant → tool/call → tool/result → assistant），打印 `seq` 与 `time`，确认单调递增。
2. **校验**：尝试 `append('user/message', { cb: () => {} })`，确认抛错；再试 `append('x', { when: new Date() })`，确认 Date 也被拒绝。
3. **快照重放**：把事件流 `snapshot()`，再 `SessionLog.replay()`，断言还原后的事件数组与原日志 `JSON.stringify` 一致。
4. **冻结**：写一个测试——`append` 返回的事件是冻结的，修改它的 `seq` 会抛 `TypeError`。
5. **回答问题**：为什么会话日志必须是 append-only、不可删改？（50 字以上，至少提到重放/事实两个理由）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/09-session-event-log
cd lessons/09-session-event-log/code && npm test
```

- 测试覆盖：seq/time、JSON 校验、冻结、快照重放一致性、只读视图。
