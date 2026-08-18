# 38-credentials-and-env 讲义

## 目标

- 实现**分层环境变量**：继承环境 > 项目 .env > 用户 .env，来源可追踪。
- 实现**凭据存储**与**脱敏**：密钥集中管理，日志/轨迹里打码。

## 1. 环境变量分层

```text
继承环境（process.env）      ← 最高优先级
项目 .env                    ← 次之
用户 .env（Harness home）    ← 最低
```

```ts
const env = loadLayeredEnv([userEnv, projectEnv], process.env)
```

加载顺序决定覆盖关系：**越靠后的源优先级越高**（本例中继承环境最后、最高）。

## 2. 凭据存储

```ts
const store = new CredentialsStore()
store.set('deepseek', 'sk-xxx')
store.get('deepseek')   // 'sk-xxx'
```

凭据集中管理，插件/工具不各自散落密钥。

## 3. 脱敏

```ts
redactSecrets('调用失败: Bearer sk-xxx', ['sk-xxx'])   // '调用失败: Bearer ***'
```

日志、轨迹、错误信息里出现密钥必须打码——第 44 课安全纵深的地基之一。

## 4. 与 dsh 的对照

dsh 的 `loadLayeredEnv`（invoking dir > home > inherited）与 `.credentials.yaml` 就是这两件事；`.env` 里的密钥只作低优先级回退。

## 小结

- 环境分层：继承 > 项目 > 用户，来源可追踪。
- 凭据集中 + 脱敏：密钥不进日志。

## 预习

- 不同产品形态怎么共用一套代码？（第 39 课：presets 与隔离域。）
