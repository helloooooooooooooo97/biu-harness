/**
 * TypedEventBus：按 SessionEventMap 类型安全地 on/emit。
 */
import type { EventKind, SessionEventMap } from './events.ts'

export class TypedEventBus {
  private readonly listeners = new Map<string, Set<(data: unknown) => void>>()

  on<K extends EventKind>(kind: K, listener: (data: SessionEventMap[K]) => void): () => void {
    const set = this.listeners.get(kind) ?? new Set<(data: unknown) => void>()
    set.add(listener as (data: unknown) => void)
    this.listeners.set(kind, set)
    return () => {
      set.delete(listener as (data: unknown) => void)
    }
  }

  emit<K extends EventKind>(kind: K, data: SessionEventMap[K]): void {
    for (const listener of this.listeners.get(kind) ?? []) {
      (listener as (d: SessionEventMap[K]) => void)(data)
    }
  }

  listenerCount(kind: EventKind): number {
    return this.listeners.get(kind)?.size ?? 0
  }
}
