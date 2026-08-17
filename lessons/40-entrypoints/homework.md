# 40-entrypoints 作业

> TODO：填写作业要求与验收标准。

## 作业

## 验收标准

```bash
node tools/verify-lesson.mjs lessons/40-entrypoints
```

## 扩展课时/作业（可选）

> 生产级补强，不影响主课验收。

- 任务：CLI 打包为可安装二进制（esbuild/bun build）并 npm 发布。验收：npm i -g 后可直接运行 dsh 命令。
- 任务：Docker 镜像 + daemon 化运行。验收：docker run 启动服务，配置与日志走挂载卷。
- 任务：配置发现三级：全局/用户/项目，优先级明确。验收：三处配置合并结果符合优先级约定。

