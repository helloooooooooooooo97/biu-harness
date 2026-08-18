# 36-cordis-yml-loader 讲义

## 目标

- 实现配置驱动加载：entries（id/name/enabled/config）→ 插件树。
- 支持 **include**（引用另一份配置）与 **`!!js` 表达式**（配置里算动态值）。
- 把第 17 课的配置加载升级成"可嵌套、可表达"的版本。

## 1. 配置 → 插件树

```json
{ "entries": [
  { "id": "tools", "name": "tools", "enabled": true },
  { "id": "prompt", "name": "prompt", "config": { "prefix": "js: ctx.platform + '-harness'" } }
] }
```

每个 entry 是"一个插件实例"：id（patch 定位用）、name（查注册表）、enabled、config（传给插件）。

## 2. include：配置可以引用配置

```json
{ "entries": [ { "id": "base", "name": "include", "config": { "file": "base.json" } } ] }
```

include 让"基础配置"被复用——产品 = 基础 + 覆盖。

## 3. !!js 表达式

配置是静态数据，但有些值要运行时才算（比如平台、环境变量）。用 `js:` 前缀标记表达式：

```ts
evalJs('js: ctx.platform + "-harness"', { platform: 'linux' })   // 'linux-harness'
```

表达式在装载时求值，`ctx` 提供运行环境（这里是变量表，真实 dsh 提供 Loader 上下文）。

## 4. 与 dsh 的对照

dsh 的 `cordis:include`/`cordis:group` 是内置插件，`!!js` 是 include 的表达式语法（第 37 课 profile/patch 会在此基础上分层）。本课是它的最小实现。

## 小结

- entries = 插件实例清单；include = 配置复用；js: 表达式 = 动态值。
- 装载顺序：解析 → 展开 include → 求值 js → 挂插件树。

## 预习

- 多份配置怎么分层覆盖？（第 37 课：profile/bundle/patch。）
