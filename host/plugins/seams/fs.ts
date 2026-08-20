import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, relative, resolve } from 'node:path'
import { Service, type Context } from 'cordis'
import '../../types.ts'

export class FsService extends Service {
  constructor(
    ctx: Context,
    public root: string,
  ) {
    super(ctx, 'fs')
    this.root = resolve(root)
  }

  resolve(rel: string) {
    const full = resolve(this.root, rel)
    const relToRoot = relative(this.root, full)
    if (relToRoot.startsWith('..') || normalize(rel).startsWith('..')) throw new Error('path escapes workspace')
    return full
  }

  async read(rel: string) {
    const path = this.resolve(rel)
    this.ctx.emit('fs/read', rel)
    return readFile(path, 'utf8')
  }

  async write(rel: string, content: string) {
    const path = this.resolve(rel)
    await mkdir(dirname(path), { recursive: true })
    this.ctx.emit('fs/write', rel)
    await writeFile(path, content, 'utf8')
    return { ok: true, path: rel }
  }

  async list(rel = '.') {
    const path = this.resolve(rel)
    this.ctx.emit('fs/list', rel)
    return readdir(path)
  }
}

export const name = 'fs'
export const inject = ['tools']

export function apply(ctx: Context, config: { root?: string } = {}) {
  const root = config.root ?? process.env.CORDIS_WORKSPACE ?? join(process.cwd(), '.workspace')
  const fs = new FsService(ctx, root)
  void mkdir(root, { recursive: true })
  ctx.tools.register({
    name: 'fs_read',
    description: '读取工作区内文件',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    execute: (args) => fs.read(String(args.path)),
  })
  ctx.tools.register({
    name: 'fs_write',
    description: '写入工作区内文件',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content'],
    },
    execute: (args) => fs.write(String(args.path), String(args.content ?? '')),
  })
  ctx.tools.register({
    name: 'fs_list',
    description: '列出工作区目录',
    parameters: { type: 'object', properties: { path: { type: 'string' } } },
    execute: (args) => fs.list(String(args.path || '.')),
  })
}
