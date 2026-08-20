# hmr-dev

Cordis 插槽壳 + host 控制台。前端按 registry / contributors / orchestration / infrastructure 分插件；host 同类目录提供 `/api` 与 snapshot。

对标 DeepSeek Harness 时只吸收其优点，见 [`docs/dsh-advantages.md`](docs/dsh-advantages.md)。

```bash
make          # 或 make dev：host + Vite
make stop     # 端口被占用时先停旧进程
# npm install && npm run dev
```

- UI http://127.0.0.1:5173
- API http://127.0.0.1:3141

若出现 `EADDRINUSE` / `Port 5173 is in use`，说明上次 `make dev` 还在跑：先 `make stop` 再 `make dev`。

侧栏开关 host 插件时，`ui-hub` 会装卸对应卡片。问候/便签在卡片里直接 `fetch`。
