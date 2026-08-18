# 40-entrypoints 讲义

## 目标

- 实现三种入口形态：**headless CLI**（一次跑完）、**JSON-RPC**（进程间调用）、Web（后续）。
- 理解"入口只是薄壳"：所有入口都调用同一个 loop，只是外壳不同。
- 里程碑 **M7**：mini-dsh 变成可启动的产品。

## 1. 入口是薄壳

```text
headless:   prompt → loop → 打印最终回答
JSON-RPC:   { method: 'run', params: { prompt } } → loop → { result }
Web:        浏览器 → 会话事件流 → UI（第 42 课）
```

**loop 只有一套，入口只是不同的"包装"**——这正是第 34 课"一切皆插件"的体现：入口也是可替换的。

## 2. Headless

```ts
const runner = new HeadlessRunner({ llm, session, tools })
const answer = await runner.run('统计文件行数')   // 打印后退出
```

一次 prompt、一个回合、打印最终回答。

## 3. JSON-RPC

```ts
const server = new JsonRpcServer(handlers)
server.handleLine('{"id":1,"method":"run","params":{"prompt":"hi"}}')
// → {"id":1,"result":"..."}
```

JSON-RPC 让**另一个进程/工具**驱动 harness（Python SDK、编辑器插件都走它）。

## 4. 与 dsh 的对照

dsh 的 `dsh --profile headless "任务"`、`apps/web`、ACP/JSON-RPC 就是这三类；Python SDK 通过 JSON-RPC stdio 驱动。本课的 headless + JSON-RPC 是它的最小实现。

## 小结

- 入口 = 薄壳：headless 打印、JSON-RPC 响应、Web 渲染。
- 同一 loop 多入口，产品形态由入口决定。

## 预习

- agent 的技能系统？（第 41 课：Skills。）
