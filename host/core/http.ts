import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { extname, join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { Service, type Context } from 'cordis'
import { WebSocketServer, type WebSocket } from 'ws'
import type { Method, RouteContext, RouteHandler } from '../types.ts'

interface Route {
  method: Method
  pattern: string
  keys: string[]
  regexp: RegExp
  handler: RouteHandler
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
}

function compile(pattern: string) {
  const keys: string[] = []
  const regexp = new RegExp(
    '^' +
      pattern.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
        keys.push(key)
        return '([^/]+)'
      }) +
      '$',
  )
  return { keys, regexp }
}

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(null)
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('invalid json'))
      }
    })
    req.on('error', reject)
  })
}

export class HttpService extends Service {
  static inject = [] as const

  private routes: Route[] = []
  private sockets = new Set<WebSocket>()
  private server?: Server
  private wss?: WebSocketServer
  readonly publicDir: string

  constructor(ctx: Context, public config: { port: number; publicDir: string }) {
    super(ctx, 'http')
    this.publicDir = config.publicDir

    ctx.effect(() => {
      const server = createServer((req, res) => {
        void this.dispatch(req, res)
      })
      const wss = new WebSocketServer({ server, path: '/ws' })
      wss.on('connection', (socket) => {
        this.sockets.add(socket)
        socket.send(JSON.stringify({ type: 'hello', payload: { ok: true } }))
        socket.on('close', () => this.sockets.delete(socket))
      })
      server.listen(config.port, () => {
        ctx.emit('http/ready', { port: config.port })
        ctx.logger('http').info(`listening on http://127.0.0.1:${config.port}`)
      })
      this.server = server
      this.wss = wss
      return () =>
        new Promise<void>((resolve) => {
          for (const socket of this.sockets) socket.close()
          wss.close()
          server.close(() => resolve())
        })
    }, 'http.listen')
  }

  route(method: Method, pattern: string, handler: RouteHandler) {
    return this.ctx.effect(() => {
      const { keys, regexp } = compile(pattern)
      const route: Route = { method, pattern, keys, regexp, handler }
      this.routes.push(route)
      this.ctx.emit('hub/change')
      return () => {
        const i = this.routes.indexOf(route)
        if (i >= 0) this.routes.splice(i, 1)
        this.ctx.emit('hub/change')
      }
    }, `http.route ${method} ${pattern}`)
  }

  broadcast(type: string, payload: unknown) {
    const data = JSON.stringify({ type, payload, ts: Date.now() })
    for (const socket of this.sockets) {
      if (socket.readyState === socket.OPEN) socket.send(data)
    }
  }

  listRoutes() {
    return this.routes.map(({ method, pattern }) => ({ method, pattern }))
  }

  private async dispatch(req: IncomingMessage, res: ServerResponse) {
    const host = req.headers.host ?? 'localhost'
    const url = new URL(req.url ?? '/', `http://${host}`)
    const method = (req.method ?? 'GET').toUpperCase() as Method

    const match = [...this.routes].reverse().find((route) => {
      if (route.method !== method) return false
      return route.regexp.test(url.pathname)
    })

    if (match) {
      const result = url.pathname.match(match.regexp)
      const params: Record<string, string> = {}
      match.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(result?.[i + 1] ?? '')
      })
      const context: RouteContext = {
        req,
        res,
        params,
        query: url.searchParams,
        json: <T = unknown>() => parseBody(req) as Promise<T>,
        send: (status, body) => {
          res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify(body))
        },
      }
      try {
        await match.handler(context)
      } catch (error) {
        this.ctx.logger('http').error(error)
        if (!res.headersSent) context.send(500, { error: String(error) })
      }
      return
    }

    if (method === 'GET') {
      await this.serveStatic(url.pathname, res)
      return
    }

    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'not found' }))
  }

  private async serveStatic(pathname: string, res: ServerResponse) {
    let relative = pathname === '/' ? '/index.html' : pathname
    relative = relative.replace(/\.\./g, '')
    const file = join(this.publicDir, relative)
    try {
      const data = await readFile(file)
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      res.end(data)
    } catch {
      if (pathname.startsWith('/api/')) {
        res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'not found — 对应插件可能已卸载' }))
        return
      }
      try {
        const fallback = await readFile(join(this.publicDir, 'index.html'))
        res.writeHead(200, { 'content-type': MIME['.html'] })
        res.end(fallback)
      } catch {
        res.writeHead(404).end('not found')
      }
    }
  }
}

export function apply(ctx: Context, config: { port: number; publicDir: string }) {
  new HttpService(ctx, config)
}

export const name = 'http'
export const inject = [] as const
