# cordis-web / dlh-optimization

本仓库将 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 作为 **git submodule** 引入，便于直接阅读与参考其完整源码。

## 依赖

| 路径 | 说明 |
| --- | --- |
| `deepseek-harness/` | DeepSeek Harness（`dsh`）上游源码，当前跟踪 `master` |

## 初始化 / 更新 submodule

克隆本仓库后：

```sh
git submodule update --init --recursive
```

更新到上游最新提交：

```sh
git submodule update --remote --merge deepseek-harness
```

## 源码入口（参考）

- 总览：`deepseek-harness/README.md` / `deepseek-harness/README.zh.md`
- 包与插件：`deepseek-harness/packages/`
- CLI：`deepseek-harness/apps/cli/`
- 文档：`deepseek-harness/docs/`
