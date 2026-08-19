.PHONY: dev host web test install

# 默认：装依赖并同时起 host(:3141) + Vite(:5173)
dev: install
	npm run dev

host:
	npm run dev:host

web:
	npm run dev:web

install:
	npm install

test:
	npm test
