/**
 * EventBus：事件四模式分发。
 *   emit     同步、按注册顺序、无返回值
 *   waterfall 同步、按序、可委托/短路（(...args, next)）
 *   parallel 并行、等待全部、返回结果数组
 *   serial   按序、依次 await、返回最后一个结果
 */

export type EventMode = 'emit' | 'waterfall' | 'parallel' | 'serial'
/** 事件总线按惯例用 any[]：任意 listener 签名都可注册（与 Node EventEmitter 一致）。 */
export type Listener = (...args: any[]) => unknown

export interface EventBusOptions {
  /** true 时插入队首（在普通注册之前执行）。 */
  prepend?: boolean
}

export class EventBus {
  private readonly listeners = new Map<string, Listener[]>()

  on(kind: string, listener: Listener, options: EventBusOptions = {}): () => void {
    const list = this.listeners.get(kind) ?? []
    if (options.prepend) list.unshift(listener)
    else list.push(listener)
    this.listeners.set(kind, list)
    return () => this.off(kind, listener)
  }

  off(kind: string, listener: Listener): void {
    const list = this.listeners.get(kind)
    if (!list) return
    const index = list.indexOf(listener)
    if (index >= 0) list.splice(index, 1)
    if (list.length === 0) this.listeners.delete(kind)
  }

  listenerCount(kind: string): number {
    return this.listeners.get(kind)?.length ?? 0
  }

  /** emit：同步、按注册顺序通知，忽略返回值。 */
  emit(kind: string, ...args: unknown[]): void {
    for (const listener of [...(this.listeners.get(kind) ?? [])]) {
      listener(...args)
    }
  }

  /**
   * waterfall：同步、按注册顺序；listener 形如 (value, ...args, next)。
   * 调用 next(wrapped) 委托给下一个；不调用 next 直接 return 则短路。
   */
  waterfall(kind: string, initial: unknown, ...args: unknown[]): unknown {
    let value = initial
    for (const listener of [...(this.listeners.get(kind) ?? [])]) {
      let delegated = false
      const next = (wrapped: unknown): void => {
        value = wrapped
        delegated = true
      }
      const result = (listener as Listener)(value, ...args, next)
      if (!delegated) return result
    }
    return value
  }

  /** parallel：并行执行所有监听器并等待，返回结果数组（按注册顺序）。 */
  async parallel(kind: string, ...args: unknown[]): Promise<unknown[]> {
    const listeners = [...(this.listeners.get(kind) ?? [])]
    return Promise.all(listeners.map((listener) => (listener as Listener)(...args)))
  }

  /** serial：按注册顺序依次 await，返回最后一个监听器的结果。 */
  async serial(kind: string, ...args: unknown[]): Promise<unknown> {
    let result: unknown
    for (const listener of [...(this.listeners.get(kind) ?? [])]) {
      result = await (listener as Listener)(...args)
    }
    return result
  }
}
