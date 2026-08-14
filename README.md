# Cordis Workshop

两边都跑 Cordis，目录按进程命名：

- **`host/`** — Node 里的 Host 插件树（HTTP、问候、便签、热插拔）
- **`web/`** — 浏览器里的 Web 插件树（插槽、React 投影）

这和 DeepSeek Harness 的 Host / Web Client 拆分一致。

页面组合只有一套 API：

```ts
ctx.slots.register({ name, children?, inject? }, Component)
ctx.slots.inject('stage', () => ctx.slots.register({ name: 'stage', key: 'greet' }, GreetCard))
```

`web/` 内部三层：

| 层 | 路径 |
|---|---|
| 对象层，零 React | `web/runtime` |
| 插槽核心 | `web/ui-slots` |
| ctx↔React 胶水 | `web/web-react` |

## 运行

```bash
npm install
npm run dev
```

打开 http://127.0.0.1:5173
