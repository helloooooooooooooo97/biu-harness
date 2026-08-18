/** 工作区守卫：边界 + 权限 + guardFs（第 44 课）。 */
import { resolve } from 'node:path'

export type Grant = 'read' | 'write'
export type AccessMode = 'read-only' | 'workspace-write'

export class WorkspaceGuard {
  private readonly root: string

  constructor(workspaceRoot: string, private readonly mode: AccessMode = 'workspace-write') {
    this.root = resolve(workspaceRoot)
  }

  inside(path: string): boolean {
    const normalized = resolve(this.root, path)
    return normalized === this.root || normalized.startsWith(`${this.root}/`)
  }

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
