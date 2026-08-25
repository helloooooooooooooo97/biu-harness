import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { Service, type Context } from 'cordis'

interface Term {
  id: string
  child: ChildProcessWithoutNullStreams
  buffer: string
}

export class TerminalService extends Service {
  private terms = new Map<string, Term>()

  constructor(ctx: Context) {
    super(ctx, 'terminals')
  }

  open() {
    const id = crypto.randomUUID().slice(0, 8)
    const child = spawn('/bin/sh', [], {
      cwd: this.ctx.sandbox.wrap({ argv: ['/bin/sh'] }).cwd,
      env: this.ctx.sandbox.wrap({ argv: ['/bin/sh'] }).env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const term: Term = { id, child, buffer: '' }
    const append = (chunk: Buffer) => {
      term.buffer += chunk.toString('utf8')
      if (term.buffer.length > 32_000) term.buffer = term.buffer.slice(-16_000)
    }
    child.stdout.on('data', append)
    child.stderr.on('data', append)
    this.terms.set(id, term)
    return { id }
  }

  write(id: string, data: string) {
    const term = this.terms.get(id)
    if (!term) throw new Error(`unknown terminal: ${id}`)
    term.child.stdin.write(data)
    return { id, ok: true }
  }

  read(id: string) {
    const term = this.terms.get(id)
    if (!term) throw new Error(`unknown terminal: ${id}`)
    return { id, output: term.buffer }
  }

  close(id: string) {
    const term = this.terms.get(id)
    if (!term) throw new Error(`unknown terminal: ${id}`)
    term.child.kill('SIGTERM')
    this.terms.delete(id)
    return { id, closed: true }
  }
}

export const name = 'terminal'
export const inject = ['sandbox', 'tools']

export function apply(ctx: Context) {
  const terminals = new TerminalService(ctx)
  ctx.tools.register({
    name: 'terminal_open',
    description: '打开持久 shell',
    parameters: { type: 'object', properties: {} },
    execute: () => terminals.open(),
  })
  ctx.tools.register({
    name: 'terminal_write',
    description: '向持久 shell 写入',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' }, data: { type: 'string' } },
      required: ['id', 'data'],
    },
    execute: (args) => terminals.write(String(args.id), String(args.data)),
  })
  ctx.tools.register({
    name: 'terminal_read',
    description: '读取持久 shell 缓冲',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    execute: (args) => terminals.read(String(args.id)),
  })
  ctx.tools.register({
    name: 'terminal_close',
    description: '关闭持久 shell',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    execute: (args) => terminals.close(String(args.id)),
  })
}
