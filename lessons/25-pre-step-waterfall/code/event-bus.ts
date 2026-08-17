/** EventBus（精简版）：on/off + waterfall（第 15 课语义）。 */

export type Listener = (...args: any[]) => unknown

export class EventBus {
  private readonly listeners = new Map<string, Listener[]>()

  on(kind: string, listener: Listener): () => void {
    const list = this.listeners.get(kind) ?? []
    list.push(listener)
    this.listeners.set(kind, list)
    return () => {
      const index = list.indexOf(listener)
      if (index >= 0) list.splice(index, 1)
    }
  }

  /**
   * waterfall：同步、按注册顺序；listener 形如 (value, ...args, next)。
   * 调 next(新值) 委托；不调 next 直接 return 则短路。
   */
  waterfall(kind: string, initial: unknown, ...args: unknown[]): unknown {
    let value = initial
    for (const listener of [...(this.listeners.get(kind) ?? [])]) {
      let delegated = false
      const next = (wrapped: unknown): void => {
        value = wrapped
        delegated = true
      }
      const result = listener(value, ...args, next)
      if (!delegated) return result
    }
    return value
  }
}
