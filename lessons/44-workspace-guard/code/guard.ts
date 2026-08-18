/** 工作区守卫：边界 + 权限（第 44 课）。 */
import { resolve } from 'node:path'

export type Grant = 'read' | 'write'
export type AccessMode = 'read-only' | 'workspace-write'

export class WorkspaceGuard {
  private readonly root: string

  constructor(workspaceRoot: string, private readonly mode: AccessMode = 'workspace-write') {
    this.root = resolve(workspaceRoot)
  }

  /** 规范化路径并判断是否在工作区内。 */
  resolve(path: string): string {
    return resolve(this.root, path)
  }

  inside(path: string): boolean {
    const normalized = this.resolve(path)
    return normalized === this.root || normalized.startsWith(`${this.root}/`)
  }

  /** 判断某操作是否被允许。 */
  allow(path: string, grant: Grant): boolean {
    if (!this.inside(path)) return false
    if (grant === 'write' && this.mode === 'read-only') return false
    return true
  }
}

export interface FsLike {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
}

/** 给 fs seam 套守卫：读写前先检查。 */
export function guardFs(fs: FsLike, guard: WorkspaceGuard): FsLike {
  return {
    async readFile(path) {
      if (!guard.allow(path, 'read')) throw new Error(`越界: ${path}`)
      return fs.readFile(path)
    },
    async writeFile(path, content) {
      if (!guard.allow(path, 'write')) throw new Error(`越界: ${path}`)
      return fs.writeFile(path, content)
    },
  }
}
