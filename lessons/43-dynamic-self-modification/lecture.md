# 43-dynamic-self-modification 讲义

## 目标

- 实现**动态插件宿主**：`define` → `run` → `stop` → `undefine`。
- 理解**双半插件**：host 半（服务/工具）+ browser 半（UI 组件），browser 半需要审批。
- 里程碑 **M8**：agent 自己写插件并热挂载到前端——"运行中改写自己"。

## 1. 动态插件生命周期

```text
cordis_define（记录定义，语法检查）→ dyn-1
cordis_run（执行 host 半；有 browser 半需审批）→ 热挂载
cordis_stop（逆序卸载，撤回 UI）
cordis_undefine（忘记定义）
```

动态插件在**内存**里，会话作用域；要持久化就得走正常插件开发流程。

## 2. 双半插件

```ts
define({
  name: 'my-plugin',
  purpose: '给 UI 加个按钮',
  host: 'ctx.provide("greeting", () => "hi")',        // host 半：注册服务
  client: 'slots.register("button", ...)',             // browser 半：注册 UI
})
```

- **host 半**：在隔离上下文里执行，能注册服务/工具（教学版用 `new Function`，真实 dsh 用 vm 沙箱）；
- **browser 半**：给前端挂 UI，需要人工审批（`cordis/request-run`）。

## 3. 与 dsh 的对照

dsh 的 `tool-cordis`（inspect/define/run/stop/undefine）+ `cordis-host-runner`（vm 沙箱）+ `cordis-client-runner`（浏览器半）+ `ui-cordis`（面板）就是这套；沙箱"隔离 globals 但不是安全边界"。

## 小结

- 动态插件 = 内存态、会话作用域、可审批、可回滚。
- 双半插件 = host 服务 + browser UI，一次定义两处生效。
- **M8 达成**：agent 写组件 → 热挂载到前端。

## 预习

- 文件边界怎么守卫？（第 44 课。）
