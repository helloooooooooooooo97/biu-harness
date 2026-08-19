# hmr-dev

Cordis 插槽壳 + host 控制台。前端按 registry / contributors / orchestration / infrastructure 分插件；host 同类目录提供 `/api` 与 snapshot。

```bash
make          # 或 make dev：host + Vite
# npm install && npm run dev
```

- UI http://127.0.0.1:5173
- API http://127.0.0.1:3141

侧栏开关 host 插件时，`ui-hub` 会装卸对应卡片。问候/便签在卡片里直接 `fetch`。
