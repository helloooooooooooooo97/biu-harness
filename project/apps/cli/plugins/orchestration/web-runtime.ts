/**
 * [orchestration] web-runtime：web 表面 bundle——宿主侧 glue 插件（对应 dsh 的
 * web-runtime）。启动 HTTP server：/ 渲染页面、/client.js 提供浏览器 bundle、
 * /hmr 提供 SSE 事件流；fiber dispose 时关闭 server（可逆）。
 * config：{ host?, port? }。
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Context, type Plugin } from '@deepseek-ai/cordis'

export interface WebRuntime {
  url(): string
  port(): number
  publish(event: object): void
  close(): Promise<void>
}

export const plugin: Plugin<unknown> = {
  name: 'web-runtime',
  provide: 'webRuntime',
  inject: ['frontendStatic'],
  apply(ctx: Context, config: unknown) {
    const { host = '127.0.0.1', port = 0 } = (config ?? {}) as { host?: string; port?: number }
    const frontend = ctx.get('frontendStatic') as { read(name: string): string | undefined }
    const clients = new Set<ServerResponse>()
    const server: Server = createServer((req, res) => {
      const path = (req.url ?? '/').split('?')[0]
      if (path === '/hmr') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        })
        res.write('retry: 2000\n\n')
        clients.add(res)
        req.on('close', () => clients.delete(res))
        return
      }
      if (path === '/' || path === '/index.html' || path === '/client.js') {
        const name = path === '/client.js' ? 'client.js' : 'index.html'
        const body = frontend.read(name)
        if (body === undefined) {
          res.writeHead(404)
          res.end(`missing ${name}`)
          return
        }
        res.writeHead(200, {
          'Content-Type': name === 'client.js' ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8',
        })
        res.end(body)
        return
      }
      res.writeHead(404)
      res.end('not found')
    })
    server.on('error', (err) => console.error(`web-runtime server error: ${err.message}`))
    server.listen(port, host)
    const runtime: WebRuntime = {
      port: () => (server.address() as AddressInfo | null)?.port ?? 0,
      url: () => `http://127.0.0.1:${runtime.port()}`,
      publish: (event: object) => {
        const payload = `data: ${JSON.stringify(event)}\n\n`
        for (const client of clients) client.write(payload)
      },
      close: () => new Promise<void>((resolve) => {
        for (const client of clients) client.end()
        server.close(() => resolve())
      }),
    }
    ctx.provide('webRuntime', runtime)
    // fiber dispose 时逆序撤销：关掉 server、断开 SSE 客户端
    return () => {
      runtime.close().catch(() => {})
    }
  },
}
