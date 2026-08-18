# 38-credentials-and-env 作业

## 作业

1. **跑测试**：`cd code && npm test`。
2. **分层优先级**：写测试——user 定义 `KEY=a`、project 定义 `KEY=b`、inherited 定义 `KEY=c`，`loadLayeredEnv([user, project], inherited)` 得到 `c`。
3. **脱敏**：写测试——`redactSecrets` 把出现的密钥替换成 `***`，普通文本不变。
4. **凭据读写**：写测试——`CredentialsStore` set/get/has/remove 正常。
5. **回答问题**：为什么继承环境优先级最高？（提示：CI/容器注入。）

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/38-credentials-and-env
cd lessons/38-credentials-and-env/code && npm test
```

- 原有测试 + 你新增的 2 个测试全过；`npx tsc --noEmit` 无错误。
