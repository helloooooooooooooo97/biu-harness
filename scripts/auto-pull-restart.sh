#!/usr/bin/env bash
# 定时 git fetch/pull；远端有更新则 make restart。
# Git/GitHub 无法主动推送到本机执行命令，本地只能轮询（或自建 webhook 接收端）。
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

INTERVAL="${AUTO_INTERVAL:-20}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
DEV_PID=""

log() {
  printf '[auto %s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

stop_dev() {
  if [[ -n "${DEV_PID}" ]] && kill -0 "${DEV_PID}" 2>/dev/null; then
    kill "${DEV_PID}" 2>/dev/null || true
    wait "${DEV_PID}" 2>/dev/null || true
  fi
  DEV_PID=""
  make --no-print-directory stop >/dev/null 2>&1 || true
}

restart_dev() {
  stop_dev
  sleep 0.5
  log "make restart"
  # 后台跑，脚本继续轮询；端口由 make stop 回收
  make --no-print-directory restart &
  DEV_PID=$!
}

cleanup() {
  log "stopping"
  stop_dev
}
trap cleanup EXIT INT TERM

if ! git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  log "no upstream for ${BRANCH}; set with: git push -u origin ${BRANCH}"
  exit 1
fi

log "branch=${BRANCH} every ${INTERVAL}s (AUTO_INTERVAL=秒数 可改)"
log "Git 不会主动通知本机；本命令是本地轮询 pull"
restart_dev

while true; do
  sleep "${INTERVAL}"

  if [[ -n "${DEV_PID}" ]] && ! kill -0 "${DEV_PID}" 2>/dev/null; then
    log "dev exited; restarting"
    restart_dev
    continue
  fi

  before="$(git rev-parse HEAD)"
  if ! git fetch --quiet origin; then
    log "fetch failed; retry later"
    continue
  fi

  remote="$(git rev-parse "origin/${BRANCH}" 2>/dev/null || true)"
  if [[ -z "${remote}" ]]; then
    log "missing origin/${BRANCH}; skip"
    continue
  fi

  if [[ "${before}" == "${remote}" ]]; then
    continue
  fi

  log "update ${before:0:7} → ${remote:0:7}; pulling"
  if ! git pull --ff-only origin "${BRANCH}"; then
    log "pull failed (need fast-forward); skip restart"
    continue
  fi
  restart_dev
done
