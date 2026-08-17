#!/usr/bin/env bash
# 安装并启动官方 dsh（DeepSeek Harness Web UI）
# 用法: bash start.sh [额外参数，如 --port 8080]
set -euo pipefail

# 1. 检查 Node.js
node_version="$(node -v 2>/dev/null || true)"
if [[ -z "$node_version" ]]; then
  echo "❌ 未找到 Node.js。请先安装 Node.js 22+（https://nodejs.org）。"
  exit 1
fi
echo "✔ Node.js $node_version"

# 2. 检查 API Key（不强制，但建议）
if [[ -z "${DEEPSEEK_API_KEY:-}" ]]; then
  echo "⚠️  未设置 DEEPSEEK_API_KEY。界面仍可打开，但任务需要真实密钥。"
  echo "   导出方式: export DEEPSEEK_API_KEY=\"sk-...\""
else
  echo "✔ 已检测到 DEEPSEEK_API_KEY"
fi

# 3. 启动 Web UI
echo "▶ npx -y @deepseek-ai/dsh web $*"
exec npx -y @deepseek-ai/dsh web "$@"
