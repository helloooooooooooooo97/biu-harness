import { mkdir, rm, writeFile, access } from 'node:fs/promises'
import { dirname, join, normalize, relative, resolve } from 'node:path'
import { Service, type Context } from 'cordis'
import '../../types.ts'
import { currentSessionId } from '../core/session-scope.ts'

export interface ProjectFileBlob {
  path: string
  content: string
}

const MAX_FILES = 2_000
const MAX_BYTES = 512 * 1024

export class SessionProjectsService extends Service {
  readonly baseDir: string
  private synced = new Set<string>()

  constructor(ctx: Context, baseDir?: string) {
    super(ctx, 'sessionProjects')
    this.baseDir = resolve(baseDir ?? join(process.cwd(), '.cordis', 'session-projects'))
  }

  rootOf(sessionId: string) {
    const id = sanitizeId(sessionId)
    return join(this.baseDir, id)
  }

  isSynced(sessionId: string) {
    return this.synced.has(sessionId)
  }

  async exists(sessionId: string) {
    try {
      await access(this.rootOf(sessionId))
      return true
    } catch {
      return false
    }
  }

  async clear(sessionId: string) {
    this.synced.delete(sessionId)
    await rm(this.rootOf(sessionId), { recursive: true, force: true })
  }

  /** 全量替换会话项目镜像（浏览器绑定文件夹的文本快照）。 */
  async sync(sessionId: string, files: ProjectFileBlob[]) {
    if (files.length > MAX_FILES) throw new Error(`too many files (max ${MAX_FILES})`)
    const root = this.rootOf(sessionId)
    await rm(root, { recursive: true, force: true })
    await mkdir(root, { recursive: true })
    let written = 0
    for (const file of files) {
      const rel = normalizeRel(file.path)
      if (!rel) continue
      const content = String(file.content ?? '')
      if (Buffer.byteLength(content, 'utf8') > MAX_BYTES) {
        throw new Error(`file too large: ${rel} (max ${MAX_BYTES} bytes)`)
      }
      const abs = resolve(root, rel)
      if (relative(root, abs).startsWith('..')) throw new Error(`path escapes project: ${rel}`)
      await mkdir(dirname(abs), { recursive: true })
      await writeFile(abs, content, 'utf8')
      written += 1
    }
    this.synced.add(sessionId)
    return { root, written }
  }
}

function sanitizeId(sessionId: string) {
  const id = String(sessionId).replace(/[^a-zA-Z0-9._-]/g, '_')
  if (!id) throw new Error('invalid session id')
  return id
}

function normalizeRel(path: string) {
  const raw = String(path || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const norm = normalize(raw)
  if (!norm || norm === '.' || norm.startsWith('..')) return ''
  return norm
}

export const name = 'session-projects'
export const inject = ['systemPrompt', 'sessions'] as const

export function apply(ctx: Context, config: { baseDir?: string } = {}) {
  new SessionProjectsService(ctx, config.baseDir)
  ctx.systemPrompt.register('session.project', () => {
    const sessionId = currentSessionId()
    if (!sessionId) return ''
    const record = ctx.sessions.peek(sessionId)
    if (!record?.project) return ''
    if (!ctx.sessionProjects.isSynced(sessionId)) {
      return `当前 Session 绑定了本地项目「${record.project.name}」，但文件尚未从浏览器同步到 host。`
    }
    return `当前 Session 绑定本地项目「${record.project.name}」。bash / 文件工具的工作区根目录即为该项目（已从浏览器同步的文本文件镜像）。`
  })
}
