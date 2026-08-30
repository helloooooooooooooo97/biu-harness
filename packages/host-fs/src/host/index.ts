import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path'
import { Service, type Context } from 'cordis'
import { currentSessionId } from '@biu/host-sessions/scope'
import {
  STR_REPLACE_EDITOR_DESCRIPTION,
  STR_REPLACE_EDITOR_PARAMETERS,
  runStrReplaceEditor,
} from './str-replace-editor.ts'

export class FsService extends Service {
  constructor(
    ctx: Context,
    public defaultRoot: string,
  ) {
    super(ctx, 'fs')
    this.defaultRoot = resolve(defaultRoot)
  }

  /** 当前生效工作区：Session 已绑定 host 路径则为该目录，否则默认 `.workspace`。 */
  get root() {
    return this.effectiveRoot()
  }

  effectiveRoot() {
    return this.sessionProjectRoot() ?? this.defaultRoot
  }

  sessionProjectRoot() {
    const sessionId = currentSessionId()
    if (!sessionId) return null
    const sessions = this.ctx.get('sessions') as { peek?: (id: string) => { project?: { path?: string } } | undefined } | undefined
    const path = sessions?.peek?.(sessionId)?.project?.path
    return path ? resolve(path) : null
  }

  resolveIn(root: string, rel: string) {
    const input = String(rel)
    const full = isAbsolute(input) ? resolve(input) : resolve(root, input)
    const relToRoot = relative(root, full)
    if (relToRoot.startsWith('..') || (!isAbsolute(input) && normalize(input).startsWith('..'))) {
      throw new Error('path escapes workspace')
    }
    return full
  }

  async readIn(root: string, rel: string) {
    const path = this.resolveIn(root, rel)
    this.ctx.emit('fs/read', rel)
    return readFile(path, 'utf8')
  }

  async writeIn(root: string, rel: string, content: string) {
    const path = this.resolveIn(root, rel)
    await mkdir(dirname(path), { recursive: true })
    this.ctx.emit('fs/write', rel)
    await writeFile(path, content, 'utf8')
    return { ok: true, path: rel }
  }

  async listIn(root: string, rel = '.') {
    const path = this.resolveIn(root, rel)
    this.ctx.emit('fs/list', rel)
    return readdir(path)
  }

  resolve(rel: string) {
    return this.resolveIn(this.effectiveRoot(), rel)
  }

  async read(rel: string) {
    return this.readIn(this.effectiveRoot(), rel)
  }

  async write(rel: string, content: string) {
    return this.writeIn(this.effectiveRoot(), rel, content)
  }

  async list(rel = '.') {
    return this.listIn(this.effectiveRoot(), rel)
  }

  /** 稳定工作区（defaultRoot，不随 Session 绑定漂移）：供 DB 集合等需要固定落盘的场景使用。 */
  get workspace(): WorkspaceFs {
    const root = this.defaultRoot
    return {
      resolve: (rel: string) => this.resolveIn(root, rel),
      read: (rel: string) => this.readIn(root, rel),
      write: (rel: string, content: string) => this.writeIn(root, rel, content),
      list: (rel?: string) => this.listIn(root, rel ?? '.'),
    }
  }
}

export type WorkspaceFs = {
  resolve: (rel: string) => string
  read: (rel: string) => Promise<string>
  write: (rel: string, content: string) => Promise<unknown>
  list: (rel?: string) => Promise<string[]>
}

export const name = 'fs'
export const inject = ['tools']

export function apply(ctx: Context, config: { root?: string } = {}) {
  const root = config.root ?? process.env.CORDIS_WORKSPACE ?? join(process.cwd(), '.workspace')
  const fs = new FsService(ctx, root)
  void mkdir(root, { recursive: true })
  ctx.tools.register({
    name: 'fs_read',
    description: '读取工作区内文件（若 Session 已绑定项目路径，则为该目录）',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    execute: (args) => fs.read(String(args.path)),
  })
  ctx.tools.register({
    name: 'fs_write',
    description: '写入工作区内文件（若 Session 已绑定项目路径，则为该目录）',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content'],
    },
    execute: (args) => fs.write(String(args.path), String(args.content ?? '')),
  })
  ctx.tools.register({
    name: 'fs_list',
    description: '列出工作区目录（若 Session 已绑定项目路径，则为该目录）',
    parameters: { type: 'object', properties: { path: { type: 'string' } } },
    execute: (args) => fs.list(String(args.path || '.')),
  })
  ctx.tools.register({
    name: 'str_replace_editor',
    description: STR_REPLACE_EDITOR_DESCRIPTION,
    parameters: { ...STR_REPLACE_EDITOR_PARAMETERS },
    execute: (args) => runStrReplaceEditor(fs, args),
  })

  ctx.inject(['systemPrompt', 'sessions'], (inner) => {
    inner.systemPrompt.register('session.project', () => {
      const sessionId = currentSessionId()
      if (!sessionId) return ''
      const project = inner.sessions.peek(sessionId)?.project
      if (!project?.path) return ''
      return `当前 Session 绑定 host 工作区「${project.name}」：${project.path}。bash / 文件工具直接读写该目录（对齐 dsh workspace cwd）。`
    })
  })
}
