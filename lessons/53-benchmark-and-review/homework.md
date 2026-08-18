# 53-benchmark-and-review 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **稳定性**：写测试——同一任务跑 10 次（2 次失败），`report` 的成功率是 0.8。
3. **耗时统计**：写测试——report 的 avgDuration 与 median 正确。
4. **真实对照**：用你的 mini-dsh 与官方 dsh 跑同一个任务，填复盘模板（做得好的/差距/原因/下一步）。
5. **收官总结**：写一篇 200 字以上的学习总结：你现在能做什么、还差什么。

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/53-benchmark-and-review
cd lessons/53-benchmark-and-review/code && npm test
```

- benchmark 测试通过；复盘与总结写在你的笔记里。
