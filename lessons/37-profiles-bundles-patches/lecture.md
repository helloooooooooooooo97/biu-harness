# 37-profiles-bundles-patches 讲义

## 目标

- 理解三层组装：**bundle（出厂插件集）→ profile（产品组合）→ patch（用户覆盖）**。
- 实现 `applyPatch`（按 id 替换 / insert）与 `composeProfile`（按序叠加 bundle）。
- 理解为什么 patch 是"整行替换"而不是 deep-merge。

## 1. 三层模型

```text
bundle：一份可复用的插件 patch（dsh-base / dsh-web-app）
profile：一个产品的组合（声明 bundles 列表 + 用户 patch）
patch：  按 id 覆盖配置（profile 级 / home 级 / --patch 命令行）
```

组合顺序：

```text
每个 bundle 的 patch（按 profile.bundles 顺序）
  → profile.cordis.patch.yml
  → home 级 cordis.patch.yml
  → --patch 覆盖
```

## 2. patch 语义：整行替换

```ts
{ id: 'tools', replace: { config: { limit: 10 } } }   // 替换整行 config
{ insert: [{ id: 'extra', name: 'logger' }] }          // 插入新行
```

patch 按 **id 定位**、**整行替换**（restate 保留的字段）——不做 deep-merge。为什么？**可预测**：改动只发生在你写的那一行，不会出现"深层合并"的意外。

## 3. composeProfile

```ts
const profile = { name: 'web', bundles: ['base', 'web-app'], patch: [...] }
const entries = composeProfile(profile, bundles)   // 合并成最终插件树
```

缺失 bundle、patch 目标不存在都要响亮报错。

## 4. 与 dsh 的对照

dsh 的 `dsh.profile` / `dsh.bundle` 就是这套：bundle 的 `package.json` 声明 `dsh.bundle.patch`，profile 声明 `dsh.profile.bundles`；`--dump-config` 输出最终合并结果。本课是它的最小实现。

## 小结

- bundle 提供插件集，profile 选择并覆盖，patch 按 id 整行替换。
- 层顺序决定优先级：越晚的层越能覆盖。

## 预习

- 凭据和环境变量怎么分层？（第 38 课。）
