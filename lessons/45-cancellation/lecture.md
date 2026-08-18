# 45-cancellation 讲义

## 目标

- 实现**取消令牌**：`Cancellation`（signal + cause），取消传播给协作方。
- 实现**进程树清理**：跟踪子进程，取消时整组杀掉。
- 把第 07 课的 AbortSignal 升级成"带原因、可传播"的取消体系。

## 1. 取消令牌

```ts
const cancel = new Cancellation()
const work = abortable(longTask, cancel.signal)
cancel.cancel('用户停止')          // signal abort + 记录 cause
```

取消的三个信息：

- **signal**：协作方监听（AbortSignal）；
- **cause**：为什么取消（用户/父级/钩子/销毁），审计用；
- **可传播**：子任务继承同一 signal。

## 2. 进程树清理

```ts
const tracker = new ProcessTracker()
const pid = tracker.spawn('bash -c "..."')
cancel.signal.addEventListener('abort', () => tracker.killAll())
```

agent 启动的子进程要**整组**清理（进程树），否则 bash 死了孙子进程还在跑。

## 3. 与 dsh 的对照

dsh 的 `Agent.cancel(cause)` + 进程树清理就是这套：cause 是 TS 强制的同进程输入，取消传播给 loop、工具、子进程（第 42 课的完整版在 turn/step 层）。

## 小结

- 取消 = signal + cause + 传播。
- 子进程要整组清理，防止孤儿进程。

## 预习

- 上下文太长怎么办？（第 46 课：压缩。）
