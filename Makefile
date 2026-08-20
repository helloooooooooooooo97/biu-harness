.PHONY: dev host web test install stop

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

test:
	npm test
