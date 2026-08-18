import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { get as httpGet, type IncomingMessage } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { boot } from './index.ts'

// 本文件测 web 表面 bundle：frontend-static + web-runtime + client-hmr 串成 dsh 式
// 「构建 watcher → SSE → 浏览器 fiber 自更新」的闭环（client 端用真实 HTTP/SSE 验证）。

function webConfig(dir: string): string {
  return JSON.stringify({
    entries: [
      { id: 'fs', name: 'frontend-static', config: { dir } },
      { id: 'wr', name: 'web-runtime', config: { port: 0 } },
      {
        id: 'ch',
        name: 'client-hmr',
        config: { bundleFile: join(dir, 'client.js'), versionFile: join(dir, 'version.txt'), intervalMs: 30 },
      },
    ],
  })
}

async function waitFor(cond: () => boolean, timeoutMs = 4000): Promise<void> {
  const start = Date.now()
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (cond()) return resolve()
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor 超时'))
      setTimeout(tick, 20)
    }
    tick()
  })
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

interface SseClient {
  connected: Promise<void>
  nextReload(timeoutMs: number): Promise<{ type: string; version?: string }>
  close(): void
}

function openSse(url: string): SseClient {
  let buffer = ''
  let resolveConnected!: () => void
  const connected = new Promise<void>((resolve) => {
    resolveConnected = resolve
  })
  const waiters: Array<{
    resolve: (event: { type: string; version?: string }) => void
    reject: (err: Error) => void
    timer: NodeJS.Timeout
  }> = []
  const req = httpGet(url, (res: IncomingMessage) => {
    res.setEncoding('utf8')
    res.on('data', (chunk: string) => {
      buffer += chunk
      if (buffer.includes('retry:')) resolveConnected()
      let idx: number
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        const dataLine = block.split('\n').find((line) => line.startsWith('data:'))
        if (!dataLine) continue
        const event = JSON.parse(dataLine.slice(5).trim()) as { type: string; version?: string }
        const waiter = waiters.shift()
        if (waiter) {
          clearTimeout(waiter.timer)
          waiter.resolve(event)
        }
      }
    })
  })
  return {
    connected,
    nextReload(timeoutMs: number): Promise<{ type: string; version?: string }> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('SSE 超时：未收到 reload 事件')), timeoutMs)
        waiters.push({ resolve, reject, timer })
      })
    },
    close() {
      req.destroy()
    },
  }
}

test('web 表面：静态页面 + client bundle + SSE 重载链闭环', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mini-dsh-web-'))
  let app: ReturnType<typeof boot> | undefined
  try {
    writeFileSync(join(dir, 'index.html'), '<!doctype html><div id="app"></div><script type="module" src="/client.js"></script>')
    writeFileSync(join(dir, 'client.js'), 'export const version = "bundle"\n')
    writeFileSync(join(dir, 'version.txt'), 'v1\n')
    app = boot(webConfig(dir))
    await app.ready()
    const web = app.ctx.get('webRuntime') as { url(): string; port(): number }
    await waitFor(() => web.port() > 0)
    const base = `http://127.0.0.1:${web.port()}`

    // ① 页面和 bundle 由 frontend-static owner 提供
    const html = await fetchText(`${base}/`)
    assert.match(html, /client\.js/)
    const bundle = await fetchText(`${base}/client.js`)
    assert.match(bundle, /bundle/)

    // ② 连接 /hmr 后改 version.txt（模拟构建 watcher 重写 bundle）
    const sse = openSse(`${base}/hmr`)
    await sse.connected // 等 SSE 注册完成，否则事件会发给"尚未连接的客户端"
    writeFileSync(join(dir, 'version.txt'), 'v2\n')
    const reload = await sse.nextReload(4000)
    assert.equal(reload.type, 'reload')
    assert.equal(reload.version, 'v2')
    sse.close()

    // ③ 可逆：卸载 web-runtime → server 关闭，SSE 断链
    await app.pluginManager.remove('wr')
    await assert.rejects(() => fetch(base), /fetch failed|ECONNREFUSED/)
  } finally {
    await app?.pluginManager.remove('wr').catch(() => {}) // 失败时也要关 server，否则进程挂住
    rmSync(dir, { recursive: true, force: true })
  }
})

test('client-hmr 是自指链路：自己也能被插件热更新重载', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mini-dsh-web-'))
  let app: ReturnType<typeof boot> | undefined
  try {
    writeFileSync(join(dir, 'index.html'), '<div id="app"></div>')
    writeFileSync(join(dir, 'client.js'), 'export const version = "bundle"\n')
    writeFileSync(join(dir, 'version.txt'), 'v1\n')
    app = boot(webConfig(dir))
    await app.ready()
    assert.ok(app.pluginNames().includes('client-hmr'))
    // reload 同一个条目：dispose 旧 fiber（清掉轮询定时器）再挂新 fiber
    await app.pluginManager.reload('ch')
    assert.ok(app.pluginNames().includes('client-hmr'))
    await app.pluginManager.remove('wr')
  } finally {
    await app?.pluginManager.remove('wr').catch(() => {})
    rmSync(dir, { recursive: true, force: true })
  }
})
