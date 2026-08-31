import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { Service, type Context } from 'cordis'

interface McpServer {
  id: string
  tools: Array<{ name: string; description: string; inputSchema?: unknown }>
  call(name: string, args: Record<string, unknown>): Promise<unknown>
  dispose?(): void
}

type Pending = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

function commandForHost(command: string, args: string[]) {
  // Windows 的 npx/npm 是 .cmd 文件，Node 不能像普通 exe 一样直接 spawn。
  // 通过 ComSpec 启动，同时保留普通 node/python/二进制 MCP 的直连路径。
  if (process.platform === 'win32' && /^(npx|npm|pnpm|yarn)(?:\.cmd)?$/i.test(command)) {
    const comspec = process.env.ComSpec || process.env.COMSPEC || 'cmd.exe'
    const quote = (part: string) => (/^[A-Za-z0-9_./:@=-]+$/.test(part) ? part : `"${part.replace(/"/g, '\\"')}"`)
    return { command: comspec, args: ['/d', '/s', '/c', [command.replace(/\.cmd$/i, ''), ...args].map(quote).join(' ')] }
  }
  return { command, args }
}

class InProcessEcho implements McpServer {
  id = 'echo'
  tools = [{ name: 'mcp_echo', description: 'echo arguments', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } }]
  async call(name: string, args: Record<string, unknown>) {
    if (name !== 'mcp_echo') throw new Error(`unknown mcp tool: ${name}`)
    return { text: String(args.text ?? '') }
  }
}

class StdioMcp implements McpServer {
  id: string
  tools: McpServer['tools'] = []
  private child: ChildProcessWithoutNullStreams
  private buf = Buffer.alloc(0)
  private stderr = ''
  private seq = 0
  private pending = new Map<number, Pending>()

  constructor(id: string, command: string, args: string[], env?: Record<string, string>) {
    this.id = id
    const spec = commandForHost(command, args)
    this.child = spawn(spec.command, spec.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
      windowsHide: true,
    })
    this.child.stdout.on('data', (chunk) => this.push(chunk as Buffer))
    this.child.stderr.on('data', (chunk) => {
      this.stderr = `${this.stderr}${String(chunk)}`.slice(-8_000)
    })
    this.child.on('error', (error) => this.failPending(`MCP ${id} 无法启动：${error.message}`))
    this.child.on('close', (code) => {
      if (this.pending.size) this.failPending(`MCP ${id} 已退出（code ${code ?? 'unknown'}）：${this.stderr || '无错误输出'}`)
    })
  }

  async init() {
    await this.rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'biu-harness', version: '0.1.0' },
    })
    this.notify('notifications/initialized', {})
    const listed = (await this.rpc('tools/list', {})) as { tools?: McpServer['tools'] }
    this.tools = listed.tools ?? []
  }

  async call(name: string, args: Record<string, unknown>) {
    return this.rpc('tools/call', { name, arguments: args })
  }

  dispose() {
    this.failPending(`MCP ${this.id} 已卸载`)
    this.pending.clear()
    this.child.kill('SIGTERM')
  }

  private rpc(method: string, params: unknown) {
    const id = ++this.seq
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params })
    const msg = `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`
    // MCP 标准 stdio 传输是一行一个 JSON-RPC 消息；保留上面的旧变量，
    // 让代码兼容已编译的历史调用路径，但实际写出 NDJSON。
    const mcpMessage = `${payload}\n`
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`MCP ${this.id} 调用 ${method} 超时：${this.stderr || '服务未返回响应'}`))
      }, 30_000)
      this.pending.set(id, { resolve, reject, timer })
      this.child.stdin.write(mcpMessage, (error) => {
        if (!error) return
        clearTimeout(timer)
        this.pending.delete(id)
        reject(new Error(`MCP ${this.id} 写入失败：${error.message}`))
      })
    })
  }

  private notify(method: string, params: unknown) {
    const payload = JSON.stringify({ jsonrpc: '2.0', method, params })
    const msg = `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`
    const mcpMessage = `${payload}\n`
    this.child.stdin.write(mcpMessage)
  }

  private failPending(detail: string) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error(detail))
    }
    this.pending.clear()
  }

  private push(chunk: Buffer) {
    this.buf = Buffer.concat([this.buf, chunk])
    while (true) {
      // 现代 MCP stdio 使用 newline-delimited JSON-RPC。下面保留
      // Content-Length 分支，以兼容旧式 server。
      const newline = this.buf.indexOf(0x0a)
      if (newline >= 0) {
        const body = this.buf.subarray(0, newline).toString('utf8').trim()
        this.buf = this.buf.subarray(newline + 1)
        if (!body) continue
        try {
          const parsed = JSON.parse(body) as { id?: number; result?: unknown; error?: { message?: string } }
          if (typeof parsed.id === 'number') {
            const pending = this.pending.get(parsed.id)
            if (pending) {
              clearTimeout(pending.timer)
              this.pending.delete(parsed.id)
              if (parsed.error) pending.reject(new Error(`MCP ${this.id}：${parsed.error.message || 'JSON-RPC error'}`))
              else pending.resolve(parsed.result)
            }
            continue
          }
        } catch {
          // 若不是 JSON 行，继续尝试旧 Content-Length framing。
          this.stderr = `${this.stderr}\nMCP stdout returned invalid JSON: ${body}`.slice(-8_000)
        }
      }
      const headerEnd = this.buf.indexOf('\r\n\r\n')
      if (headerEnd < 0) return
      const header = this.buf.subarray(0, headerEnd).toString('utf8')
      const match = header.match(/Content-Length:\s*(\d+)/i)
      if (!match) return
      const length = Number(match[1])
      const start = headerEnd + 4
      if (this.buf.length < start + length) return
      const body = this.buf.subarray(start, start + length).toString('utf8')
      this.buf = this.buf.subarray(start + length)
      const parsed = JSON.parse(body) as { id?: number; result?: unknown; error?: { message?: string } }
      if (typeof parsed.id === 'number') {
        const pending = this.pending.get(parsed.id)
        if (!pending) continue
        clearTimeout(pending.timer)
        this.pending.delete(parsed.id)
        if (parsed.error) pending.reject(new Error(`MCP ${this.id}：${parsed.error.message || 'JSON-RPC error'}`))
        else pending.resolve(parsed.result)
      }
    }
  }
}

export class McpService extends Service {
  private servers = new Map<string, McpServer>()

  constructor(ctx: Context) {
    super(ctx, 'mcp')
    this.servers.set('echo', new InProcessEcho())
    ctx.effect(() => () => {
      for (const server of this.servers.values()) server.dispose?.()
      this.servers.clear()
    }, 'mcp.dispose-all')
  }

  async addStdio(id: string, command: string, args: string[], env?: Record<string, string>) {
    if (this.servers.has(id)) throw new Error(`mcp server already registered: ${id}`)
    const server = new StdioMcp(id, command, args, env)
    try {
      await server.init()
      this.servers.set(id, server)
      return this.listTools()
    } catch (error) {
      server.dispose()
      throw error
    }
  }

  remove(id: string) {
    const server = this.servers.get(id)
    if (!server) throw new Error(`unknown mcp server: ${id}`)
    if (id === 'echo') throw new Error('cannot remove built-in echo server')
    server.dispose?.()
    this.servers.delete(id)
    return { id, removed: true }
  }

  listTools() {
    return [...this.servers.values()].flatMap((server) =>
      server.tools.map((tool) => ({ server: server.id, ...tool })),
    )
  }

  listServers() {
    return [...this.servers.keys()]
  }

  async call(serverId: string, name: string, args: Record<string, unknown>) {
    const server = this.servers.get(serverId)
    if (!server) throw new Error(`unknown mcp server: ${serverId}`)
    return server.call(name, args)
  }
}

export const name = 'mcp'
export const inject = ['tools']

export function apply(ctx: Context) {
  const mcp = new McpService(ctx)
  ctx.tools.register({
    name: 'mcp_list',
    description: '列出 MCP 工具',
    parameters: { type: 'object', properties: {} },
    execute: () => mcp.listTools(),
  })
  ctx.tools.register({
    name: 'mcp_call',
    description: '调用 MCP 工具',
    parameters: {
      type: 'object',
      properties: {
        server: { type: 'string' },
        name: { type: 'string' },
        arguments: { type: 'object' },
      },
      required: ['server', 'name'],
    },
    execute: (args) =>
      mcp.call(String(args.server), String(args.name), (args.arguments as Record<string, unknown>) ?? {}),
  })
  ctx.tools.register({
    name: 'mcp_add_stdio',
    description: '挂载 stdio MCP 服务（command + args）',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        command: { type: 'string' },
        args: { type: 'array', items: { type: 'string' } },
        env: { type: 'object', description: '传给 MCP 子进程的环境变量；例如 GITHUB_PERSONAL_ACCESS_TOKEN。不会写入 Biu 配置。' },
      },
      required: ['id', 'command'],
    },
    execute: (args) => {
      const env = args.env && typeof args.env === 'object' && !Array.isArray(args.env)
        ? Object.fromEntries(Object.entries(args.env as Record<string, unknown>).map(([key, value]) => [key, String(value)]))
        : undefined
      return mcp.addStdio(String(args.id), String(args.command), Array.isArray(args.args) ? args.args.map(String) : [], env)
    },
  })
  ctx.tools.register({
    name: 'mcp_remove',
    description: '卸载已挂载的 stdio MCP 服务并杀掉进程',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    execute: (args) => mcp.remove(String(args.id)),
  })
}
