# 44-workspace-guard 讲义

## 目标

- 实现**工作区边界**：文件路径必须落在工作区内，`..` 逃逸被拒。
- 实现**读写权限**：read-only 允许读、拒绝写。
- 用 fs 包装器把守卫接进第 35 课的 fs seam。

## 1. 边界

```ts
const guard = new WorkspaceGuard('/work')
guard.allow('/work/a.txt', 'read')    // true
guard.allow('/etc/passwd', 'read')    // false（工作区外）
guard.allow('/work/../secret', 'read') // false（逃逸）
```

守卫用**规范化路径**判断（解析 `..`），防止路径穿越。

## 2. 权限

| 授权 | read | write |
| --- | --- | --- |
| read-only | ✅ | ❌ |
| workspace-write | ✅ | ✅（工作区内） |

## 3. 接入 fs seam

```ts
const guarded = guardFs(new FsLocal(), guard)   // 读/写前先检查
```

这正是第 35 课 fs seam 的"策略层"：Provider 只管读写，守卫决定"能不能"。

## 4. 与 dsh 的对照

dsh 的 `fs-sandbox` + `fs/*` 事件（`fs/write-intent`）就是这个：写文件前先过 `fs/write-intent` 门（第 27 课流水线的 fs 门）。本课的 guard 是它的最小实现。

## 小结

- 边界 = 规范化路径必须落在工作区内。
- 权限 = read-only/workspace-write 决定读写。
- 守卫接在 seam 上，Provider 无感。

## 预习

- 怎么取消一个正在跑的 agent？（第 45 课。）
