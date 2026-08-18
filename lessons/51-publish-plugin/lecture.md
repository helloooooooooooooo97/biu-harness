# 51-publish-plugin 讲义

## 目标

- 定义**插件清单**：name/version/exports/dsh 字段（bundle/profile）。
- 实现打包与**版本冲突检测**：同一插件不能发布冲突版本。
- 走完"写插件 → 打包 → 发布"的最小流程（对应 `dsh plugin add`）。

## 1. 插件清单

```ts
interface PluginManifest {
  name: string
  version: string
  exports: Record<string, string>
  dsh?: { bundle?: { patch?: string }; profile?: { bundles?: string[] } }
}
```

`dsh.bundle.patch` 指向 cordis.patch.yml（第 37 课），`dsh.profile.bundles` 声明产品组合。

## 2. 打包

```ts
const packager = new Packager()
const files = packager.pack(manifest, { 'index.ts': '...' })   // 加入 package.json + 入口
```

打包 = 清单 + 源码 → 可分发文件集。

## 3. 发布与版本

```ts
const publisher = new Publisher()
publisher.publish(manifest)   // 同 name 已有更高/相等版本 → 冲突抛错
```

版本冲突检测防止"静默覆盖"。

## 4. 与 dsh 的对照

dsh 插件通过 npm 分发：`dsh plugin add <name>` 在 profile 目录安装；`dsh` 字段声明 bundle/profile。本课是它的最小打包/发布流程。

## 小结

- 清单声明身份与 dsh 集成点；打包生成可分发文件；发布防版本冲突。

## 预习

- 结业项目三选一（第 52 课）。
