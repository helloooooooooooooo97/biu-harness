# 插件包化（问候服务示范）

对标 dsh 的 **workspace 包 + 配置组合**，本仓做瘦实现。

## 与 dsh 对比

| | 本仓（瘦） | 官方 dsh |
|---|---|---|
| Monorepo | `packages/*` + npm workspaces | `pnpm-workspace` · `packages/<group>/<pkg>` |
| 包名 | `@hmr/greeter-host` / `@hmr/greeter-ui` | `@deepseek-ai/dsh-*` |
| 组合配置 | 根目录 `cordis.plugins.json` | `cordis.yml` / `cordis.patch.yml` + profile bundles |
| 加载 | host `resolveCatalog()` 动态 `import(package)` | `@deepseek-ai/cordis-plugin-loader` |
| 热插拔 | 仍走 hub `mount` / `fiber.dispose` + ui-hub 同步 | Loader + `cordis-plugin-hmr` + config 热替换 |
| 前后端 | **刻意拆成两包**（host 能力 / web 卡片） | 常见一包或 client 子导出 |

刻意不搬：多层 patch 叠层、Schemastery Config、`__DSH_BOOT__` 动态 client 包。

## 问候服务两包

- `@hmr/greeter-host` — `ctx.greet`、tool `greet`、`GET /api/greet`、hub page
- `@hmr/greeter-ui` — Settings demos 卡片，消费 `/api/greet`

启用/禁用仍在 Settings 开关；关闭 host 插件时 ui-hub 会卸掉 `@hmr/greeter-ui`。

## 配置引入

编辑根目录 `cordis.plugins.json` 的 `plugins[]`：

```json
{
  "id": "greeter",
  "package": "@hmr/greeter-host",
  "ui": "@hmr/greeter-ui",
  "enabled": true,
  "togglable": true
}
```

重启 host 后生效。前端 `ui` 字段需在 `src/plugins/orchestration/ui-packages.ts` 登记动态 import（Vite 需静态可分析的包名）。
