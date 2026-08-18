/** 工作区锁：防止多 agent 并发写同一路径（第 50 课）。 */

export class WorkspaceLock {
  private readonly held = new Set<string>()

  acquire(path: string): boolean {
    if (this.held.has(path)) return false
    this.held.add(path)
    return true
  }

  release(path: string): void {
    this.held.delete(path)
  }

  isHeld(path: string): boolean {
    return this.held.has(path)
  }
}
