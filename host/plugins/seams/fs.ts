import { mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises'
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path'
import { Service, type Context } from 'cordis'
import '../../types.ts'
import { currentSessionId } from '../core/session-scope.ts'
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

  /** 当前生效工作区：已绑定并同步的 session 项目，否则默认 `.workspace`。 */
  get root() {
    return this.effectiveRoot()
  }

  effectiveRoot() {
    return this.sessionProjectRoot() ?? this.defaultRoot
  }

  sessionProjectRoot() {
    const sessionId = currentSessionId()
    if (!sessionId) return null
    const record = this.ctx.sessions?.peek?.(sessionId)
    if (!record?.project) return null
    if (!this.ctx.sessionProjects?.isSynced(sessionId)) {
      throw new Error(
        `session 已绑定项目「${record.project.name}」，但浏览器尚未同步文件到 host。请在前端重新 Open folder，或先发送一条消息触发同步。`,
      )
    }
    return this.ctx.sessionProjects.rootOf(sessionId)
  }

  resolve(rel: string) {
    const root = this.effectiveRoot()
    const input = String(rel)
    const full = isAbsolute(input) ? resolve(input) : resolve(root, input)
    const relToRoot = relative(root, full)
    if (relToRoot.startsWith('..') || (!isAbsolute(input) && normalize(input).startsWith('..'))) {
      throw new Error('path escapes workspace')
    }
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
    const sessionId = currentSessionId()
    if (sessionId && this.ctx.sessions?.peek?.(sessionId)?.project) {
      this.ctx.http?.broadcast('project/write', { sessionId, path: String(rel), content: String(content) })
    }
    return { ok: true, path: rel }
  }

  async list(rel = '.') {
    const path = this.resolve(rel)
    this.ctx.emit('fs/list', rel)
    return readdir(path)
  }

  async ensureReadable() {
    const root = this.effectiveRoot()
    await access(root)
    return root
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
    description: '读取工作区内文件（若 Session 已绑定项目，则为该项目）',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    execute: (args) => fs.read(String(args.path)),
  })
  ctx.tools.register({
    name: 'fs_write',
    description: '写入工作区内文件（若 Session 已绑定项目，则为该项目）',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content'],
    },
    execute: (args) => fs.write(String(args.path), String(args.content ?? '')),
  })
  ctx.tools.register({
    name: 'fs_list',
    description: '列出工作区目录（若 Session 已绑定项目，则为该项目）',
    parameters: { type: 'object', properties: { path: { type: 'string' } } },
    execute: (args) => fs.list(String(args.path || '.')),
  })
  ctx.tools.register({
    name: 'str_replace_editor',
    description: STR_REPLACE_EDITOR_DESCRIPTION,
    parameters: { ...STR_REPLACE_EDITOR_PARAMETERS },
    execute: (args) => runStrReplaceEditor(fs, args),
  })
}
