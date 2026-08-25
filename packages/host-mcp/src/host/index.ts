import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { Service, type Context } from 'cordis'

interface McpServer {
  id: string
  tools: Array<{ name: string; description: string; inputSchema?: unknown }>
  call(name: string, args: Record<string, unknown>): Promise<unknown>
  dispose?(): void
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
  private seq = 0
  private pending = new Map<number, (value: unknown) => void>()

  constructor(id: string, command: string, args: string[]) {
    this.id = id
    this.child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    this.child.stdout.on('data', (chunk) => this.push(chunk as Buffer))
  }

  async init() {
    const listed = (await this.rpc('tools/list', {})) as { tools?: McpServer['tools'] }
    this.tools = listed.tools ?? []
  }

  async call(name: string, args: Record<string, unknown>) {
    return this.rpc('tools/call', { name, arguments: args })
  }

  dispose() {
    for (const resolve of this.pending.values()) resolve(undefined)
    this.pending.clear()
    this.child.kill('SIGTERM')
  }

  private rpc(method: string, params: unknown) {
    const id = ++this.seq
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params })
    const msg = `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`
    return new Promise((resolve, reject) => {
      this.pending.set(id, resolve)
      this.child.stdin.write(msg, (error) => error && reject(error))
    })
  }

  private push(chunk: Buffer) {
    this.buf = Buffer.concat([this.buf, chunk])
    while (true) {
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
      const parsed = JSON.parse(body) as { id?: number; result?: unknown }
      if (typeof parsed.id === 'number') this.pending.get(parsed.id)?.(parsed.result)
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

  async addStdio(id: string, command: string, args: string[]) {
    if (this.servers.has(id)) throw new Error(`mcp server already registered: ${id}`)
    const server = new StdioMcp(id, command, args)
    await server.init()
    this.servers.set(id, server)
    return this.listTools()
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
      },
      required: ['id', 'command'],
    },
    execute: (args) =>
      mcp.addStdio(String(args.id), String(args.command), Array.isArray(args.args) ? args.args.map(String) : []),
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
