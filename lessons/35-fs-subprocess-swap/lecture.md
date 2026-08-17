# 35-fs-subprocess-swap 讲义

## 目标

- 用能力缝（第 34 课）实现 `fs` 与 `subprocess` 两个 seam。
- 每个 seam 两个 Provider：本地实现 + 远程/沙箱 mock。
- 演示"换 Provider 即换整个执行世界"：fs 和 subprocess 一起指向远程时，消费者代码不变。

## 1. 两个能力缝

```text
fs:         readFile / writeFile / list
subprocess: exec(command)
```

每个都是第 34 课的三角色：Definition（接口）+ Provider（local/mock）+ Consumer（`ToolExecutor`）。

## 2. Provider 们

| Seam | 本地 Provider | 远程/沙箱 Provider |
| --- | --- | --- |
| fs | `FsLocal`（node:fs，真实磁盘） | `FsRemoteMock`（内存 map，模拟远程） |
| subprocess | `SubprocessLocal`（bash 真实执行） | `SubprocessRemoteMock`（返回 canned 输出） |

消费者 `ToolExecutor` 只认接口，不知道数据在磁盘还是内存、命令在本地还是远程。

## 3. 一起换 = 换执行世界

```ts
const local = new ToolExecutor({ fs: new FsLocal(), sub: new SubprocessLocal() })
const remote = new ToolExecutor({ fs: new FsRemoteMock(), sub: new SubprocessRemoteMock() })
// 同一个 ToolExecutor 类，行为完全不同——"换 Provider 即换整个产品"
```

这正是 dsh 能力缝的价值：把 fs/subprocess 指向远程沙箱时，Bash、PTY、LSP 一起迁移，无 Provider 分叉。

## 4. 与 dsh 的对照

dsh 的 `fs/fs`、`subprocess/subprocess` 就是这两个 seam，Provider 有 local/sandbox/e2b 等；`ctx.shell`、`ctx.terminals` 是上层消费。第 44 课的 workspace guard 会在 `fs/*` 事件上做边界。

## 小结

- fs 与 subprocess 是两个能力缝，各配本地/远程两个 Provider。
- 消费者只依赖接口，换 Provider 不改消费者。
- 一起换 = 整个执行世界切换（本地 ↔ 沙箱/远程）。

## 预习

- 文件边界守卫怎么接进来？（第 44 课：fs/* 事件 + workspace guard。）
