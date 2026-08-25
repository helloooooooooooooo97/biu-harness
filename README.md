# biu

Cordis 插槽壳 + host 控制台。插件约定见 [`docs/plugin-packages.md`](docs/plugin-packages.md)。

```bash
make          # 或 make dev：host + Vite
make stop     # 端口被占用时先停旧进程
# npm install && npm run dev
```

- UI http://127.0.0.1:5173
- API http://127.0.0.1:3141

若出现 `EADDRINUSE` / `Port 5173 is in use`，说明上次 `make dev` 还在跑：先 `make stop` 再 `make dev`。

侧栏开关插件时，`ui-hub` 会装卸对应卡片。
