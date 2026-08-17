#!/usr/bin/env bash
# 生成 mini-dsh monorepo 骨架（第 18 课起填充实现）
#
# 用法:
#   bash scaffold.sh                 # 生成到 ./project
#   bash scaffold.sh --dir <path>    # 指定目录
#   bash scaffold.sh --dry-run       # 只打印结构，不落盘
set -euo pipefail

DIR="project"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help)
      echo "用法: bash scaffold.sh [--dir <path>] [--dry-run]"
      exit 0 ;;
    *)
      echo "未知参数: $1" >&2
      exit 1 ;;
  esac
done

PACKAGES=(
  core-session core-agent-loop core-tools core-system-prompt
  llm llm-deepseek tool-fs tool-bash
  approval guard credentials compaction-basic
  subagent-inprocess workflow telemetry config preset-minimal
)
APPS=(cli web server)

print_tree() {
  echo "$DIR/"
  echo "├── package.json"
  echo "├── pnpm-workspace.yaml"
  echo "├── tsconfig.base.json"
  echo "├── .gitignore"
  echo "├── README.md"
  echo "├── packages/"
  for p in "${PACKAGES[@]}"; do
    echo "│   ├── $p/{package.json,src/index.ts,README.md}"
  done
  echo "└── apps/"
  for a in "${APPS[@]}"; do
    echo "    ├── $a/{package.json,src/index.ts,README.md}"
  done
}

if [[ $DRY_RUN -eq 1 ]]; then
  print_tree
  exit 0
fi

if [[ -d "$DIR" && -n "$(ls -A "$DIR")" ]]; then
  echo "❌ 目录非空，拒绝覆盖: $DIR" >&2
  exit 1
fi

mkdir -p "$DIR"
cd "$DIR"

cat > package.json <<'EOF'
{
  "name": "mini-dsh",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  }
}
EOF

cat > pnpm-workspace.yaml <<'EOF'
packages:
  - 'packages/*'
  - 'apps/*'
EOF

cat > tsconfig.base.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
EOF

cat > .gitignore <<'EOF'
node_modules/
dist/
coverage/
*.log
.env
.env.*
!.env.example
.DS_Store
EOF

cat > README.md <<'EOF'
# mini-dsh

课程主工程：从零到一复现 DeepSeek Harness。

- 第 13-17 课：手写 mini-Cordis 内核。
- 第 18 课：换装真实 `@deepseek-ai/cordis`，包边界就绪。
- 每完成一课打 tag：`lesson-18` … `lesson-53`。

## 包布局

- `packages/core-*`：会话、loop、工具、提示词等 spine 服务。
- `packages/llm*`：LLM 词汇表与适配器。
- `packages/tool-*`：模型面工具。
- `packages/approval|guard|credentials|telemetry|...`：横切能力。
- `apps/*`：可执行入口。

> 当前为骨架，实现从第 18 课开始逐课填充。
EOF

write_pkg() {
  local name="$1" scope="${2:-packages}"
  mkdir -p "$scope/$name/src"
  cat > "$scope/$name/package.json" <<EOF
{
  "name": "@mini-dsh/$name",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "build": "tsc --noEmit",
    "test": "node --test"
  }
}
EOF
  cat > "$scope/$name/src/index.ts" <<EOF
// $name 占位实现：第 18 课起逐课填充。
export const name = '$name';
EOF
  cat > "$scope/$name/README.md" <<EOF
# @mini-dsh/$name

TODO：本包职责与实现，见 syllabus 对应课程。
EOF
}

for p in "${PACKAGES[@]}"; do
  write_pkg "$p"
done

for a in "${APPS[@]}"; do
  write_pkg "$a" apps
done

echo "✔ 骨架已生成: $(pwd)"
echo "  下一步: cd $DIR && pnpm install"
