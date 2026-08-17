/**
 * StateStore：与 effect 分离的插件状态。热重载只换行为，状态靠它保留/回滚。
 */

export class StateStore {
  private data = new Map<string, unknown>()

  set(key: string, value: unknown): void {
    this.data.set(key, value)
  }

  get<T>(key: string): T | undefined {
    return this.data.get(key) as T | undefined
  }

  get size(): number {
    return this.data.size
  }

  /** 定格当前状态（JSON 字符串，可落盘/可恢复）。 */
  snapshot(): string {
    return JSON.stringify([...this.data.entries()])
  }

  restore(snapshot: string): void {
    this.data = new Map(JSON.parse(snapshot) as Array<[string, unknown]>)
  }
}
