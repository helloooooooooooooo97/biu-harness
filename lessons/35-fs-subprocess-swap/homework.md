# 35-fs-subprocess-swap 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解两个 seam 与消费者。
2. **本地往返**：写测试——`FsLocal` 在临时目录 write 再 read，内容一致；`SubprocessLocal.exec('echo hi')` 返回 `'hi'`。
3. **远程 mock**：写测试——`FsRemoteMock` write/read/list 可用；`SubprocessRemoteMock.exec` 返回 canned 输出。
4. **一起换**：写测试——`ToolExecutor` 先用 local（真实读写），再换成 remote mock（内存读写 + canned 命令），断言消费者代码不变、行为按 Provider 变化。
5. **回答问题**：为什么"fs 和 subprocess 要一起换"比"各自单独换"更接近真实沙箱？（提示：执行世界一致。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/35-fs-subprocess-swap
cd lessons/35-fs-subprocess-swap/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
