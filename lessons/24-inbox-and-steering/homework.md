# 24-inbox-and-steering 作业

## 作业

1. **跑测试**：`cd code && npm test`，理解两个队列与三种投递。
2. **claim 语义**：写测试——先 `followup('a')`、`steer('b')`、`inject('c')`，再 `claimNextTurn()`，断言返回 `turnInput.content === 'a'`、`stepInputs` 是 `['b','c']`，且之后队列为空。
3. **step 续轮**：写测试——`inject('x')` 后 `claimNextStep()` 拿到 `['x']`，但 next-turn 不受影响。
4. **唤醒语义**：写测试——`inject` 后 status 保持 `idle`；`steer` 后 status 变 `running`。
5. **回答问题**：`steer` 和 `inject` 都进 next-step，为什么一个唤醒一个不唤醒？（提示：打断 vs 备着。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/24-inbox-and-steering
cd lessons/24-inbox-and-steering/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
