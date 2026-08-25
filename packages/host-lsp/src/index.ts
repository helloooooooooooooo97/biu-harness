import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { Service, type Context } from 'cordis'

class StdioLsp {
  private child?: ChildProcessWithoutNullStreams
  private buf = Buffer.alloc(0)
  private seq = 0
  private pending = new Map<number, (value: unknown) => void>()
  ready = false

  async start(command: string, args: string[]) {
    this.child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    this.child.stdout.on('data', (chunk) => this.push(chunk as Buffer))
    await this.rpc('initialize', {
      processId: process.pid,
      rootUri: null,
      capabilities: {},
    })
    this.child.stdin.write(
      frame({ jsonrpc: '2.0', method: 'initialized', params: {} }),
    )
    this.ready = true
  }

  async hover(uri: string, line: number, character: number) {
    if (!this.ready) return { contents: [{ value: 'lsp not started' }] }
    return this.rpc('textDocument/hover', { textDocument: { uri }, position: { line, character } })
  }

  private rpc(method: string, params: unknown) {
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      if (!this.child) return reject(new Error('lsp not started'))
      this.pending.set(id, resolve)
      this.child.stdin.write(frame({ jsonrpc: '2.0', id, method, params }), (error) => error && reject(error))
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

function frame(value: unknown) {
  const payload = JSON.stringify(value)
  return `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`
}

export class LspService extends Service {
  private session = new StdioLsp()

  constructor(ctx: Context) {
    super(ctx, 'lsp')
  }

  start(command: string, args: string[] = []) {
    return this.session.start(command, args)
  }

  async hover(path: string, line: number, character: number) {
    const uri = `file://${this.ctx.fs.resolve(path)}`
    if (!this.session.ready) {
      const text = await this.ctx.fs.read(path)
      const lines = text.split('\n')
      return { contents: [{ value: lines[line] ?? '' }], fallback: true }
    }
    return this.session.hover(uri, line, character)
  }
}

export const name = 'lsp'
export const inject = ['fs', 'tools']

export function apply(ctx: Context) {
  const lsp = new LspService(ctx)
  ctx.tools.register({
    name: 'lsp_start',
    description: '启动 LSP 进程',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string' }, args: { type: 'array', items: { type: 'string' } } },
      required: ['command'],
    },
    execute: (args) => lsp.start(String(args.command), Array.isArray(args.args) ? args.args.map(String) : []),
  })
  ctx.tools.register({
    name: 'lsp_hover',
    description: '查询工作区文件某位置的 hover；未启动 LSP 时回退到该行文本',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        line: { type: 'number' },
        character: { type: 'number' },
      },
      required: ['path'],
    },
    execute: (args) => lsp.hover(String(args.path), Number(args.line ?? 0), Number(args.character ?? 0)),
  })
}
