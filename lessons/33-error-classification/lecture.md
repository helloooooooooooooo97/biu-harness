# 33-error-classification 讲义

## 目标

- 把错误**分类**：auth / rate-limit / timeout / network / bad-request / server / unknown。
- 用分类决定**是否值得重试**（第 29 课的 `shouldRetry` 升级成系统策略）。
- 实现 `retryClassified`：只重试可恢复错误。

## 1. 为什么错误要分类

第 29 课的 `retry` 靠调用方自己写 `shouldRetry`。第 33 课把它系统化：**先分类，再决定重不重试**。

```ts
classifyError(new Error('HTTP 429: rate limit'))   // 'rate-limit' → 可重试
classifyError(new Error('HTTP 401: invalid key'))  // 'auth' → 不可重试
```

## 2. 分类与重试矩阵

| 类别 | 例子 | 重试？ |
| --- | --- | --- |
| auth | HTTP 401/403 | ❌（重试也是白费） |
| rate-limit | HTTP 429 | ✅（等退避再试） |
| timeout | 操作超时 | ✅ |
| network | fetch failed / ECONNREFUSED | ✅ |
| bad-request | HTTP 400 | ❌（参数错，重试没意义） |
| server | HTTP 5xx | ✅（服务端瞬时故障） |
| unknown | 其他 | ❌（不确定就别浪费） |

原则：**只重试"可能自己好的错误"**——限流会过去、超时/断网可能恢复、5xx 可能瞬态；鉴权失败和参数错误重试一万次也一样。

## 3. retryClassified

```ts
const reply = await retryClassified(() => llm.chat(messages), { attempts: 3, backoffMs: 200 })
```

内部：捕获错误 → `classifyError` → `isRetryable` 决定继续还是抛出。

## 4. 与 dsh 的对照

dsh 的 `llm-retry` 按 provider 路由做重试策略；错误分类是它的基础。第 45 课会把分类结果计入遥测。

## 小结

- 分类先行，重试跟随：只有可恢复错误才重试。
- auth/bad-request 立即失败，rate-limit/timeout/network/server 可重试。
- `retryClassified` 让策略集中、调用方干净。

## 预习

- 能力缝三角色怎么把 fs/subprocess/llm 都统一？（第 34 课。）
