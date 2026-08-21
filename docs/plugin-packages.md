# 真正的配置热插拔（问候服务示范）

主仓 **源码不出现、也不 import 任何具体插件包名**。插件只写在 `cordis.plugins.json`，由通用加载器解析。

## 与上一版的区别 / 与 dsh

| | 错误做法（已改掉） | 本仓正确做法 | 官方 dsh |
|---|---|---|---|
| 主仓是否写死包名 | `import '@hmr/greeter-ui'`、`ui-packages.ts` 登记 | **否**；只读配置 | 否；`cordis.yml` 的 `name` |
| 根 package.json | 写 `"@hmr/greeter-*": "*"` | **不写**；`postinstall` 按配置 symlink | workspace 包由 bundle/yml 组合 |
| Vite | 手写 alias | `cordisPluginsVite` 读配置生成 alias + `virtual:cordis-ui-loaders` | client 包清单 / boot |
| Host | catalog 静态 import | `importConfiguredPackage(配置里的字符串)` | Loader |

## 怎么加一个插件

1. 在 `packages/<dir>/` 放好包（`package.json` 的 `name` 任意 scoped 名）
2. 只改 **`cordis.plugins.json`**：

```json
{
  "id": "greeter",
  "package": "@hmr/greeter-host",
  "ui": "@hmr/greeter-ui",
  "enabled": true
}
```

3. `npm install`（或 `node scripts/link-cordis-plugins.mjs`）→ 启动

主仓 `src/` / `host/` 里搜不到 `@hmr/greeter` 字样才算合格。

## 热插拔

Settings 开关仍走 hub `fiber.dispose` / ui-hub 同步；卸掉配置项并重启即等于主仓从未安装过该插件。
