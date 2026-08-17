/** StateStore：与 effect 分离的插件状态（复用第 16 课实现）。 */

export class StateStore {
  private data = new Map<string, unknown>()

  set(key: string, value: unknown): void {
    this.data.set(key, value)
  }

  get<T>(key: string): T | undefined {
    return this.data.get(key) as T | undefined
  }

  snapshot(): string {
    return JSON.stringify([...this.data.entries()])
  }

  restore(snapshot: string): void {
    this.data = new Map(JSON.parse(snapshot) as Array<[string, unknown]>)
  }
}
