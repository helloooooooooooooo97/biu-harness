import { AsyncLocalStorage } from 'node:async_hooks'

export interface SessionScope {
  sessionId: string
}

const storage = new AsyncLocalStorage<SessionScope>()

export function runWithSession<T>(sessionId: string, fn: () => T): T {
  return storage.run({ sessionId }, fn)
}

export function currentSessionId(): string | undefined {
  return storage.getStore()?.sessionId
}
