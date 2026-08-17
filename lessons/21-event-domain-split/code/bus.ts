/** EventBus：live 事件的只分发通道（不持久化）。 */

export class EventBus {
  private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>()

  on(kind: string, listener: (...args: unknown[]) => void): () => void {
    const set = this.listeners.get(kind) ?? new Set<(...args: unknown[]) => void>()
    set.add(listener)
    this.listeners.set(kind, set)
    return () => {
      set.delete(listener)
    }
  }

  emit(kind: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(kind) ?? []) {
      listener(...args)
    }
  }

  listenerCount(kind: string): number {
    return this.listeners.get(kind)?.size ?? 0
  }
}
