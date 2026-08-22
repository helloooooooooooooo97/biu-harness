.PHONY: dev host web test install stop restart auto

# 默认：装依赖并同时起 host(:3141) + Vite(:5173)
dev: install
	npm run dev

host:
	npm run dev:host

web:
	npm run dev:web

install:
	npm install

# 释放本项目常用端口（旧 make dev / vite / host 残留）
stop:
	@for p in 3141 5173; do \
	  pids=$$(lsof -tiTCP:$$p -sTCP:LISTEN 2>/dev/null); \
	  if [ -n "$$pids" ]; then echo "kill :$$p -> $$pids"; kill $$pids 2>/dev/null || true; \
	  else echo ":$$p free"; fi; \
	done

# 先停再启（等端口释放后再 dev）
restart: stop
	@sleep 0.5
	@$(MAKE) --no-print-directory dev

# 本地轮询远端：有更新则 git pull + make restart
# 用法: make auto   或   AUTO_INTERVAL=10 make auto
# Git/GitHub 不能主动推送到你的电脑执行命令；要自动更新只能本机轮询（或自建 webhook）。
auto:
	@bash scripts/auto-pull-restart.sh

test:
	npm test
