/** 取消令牌与进程树清理（第 45 课）。 */

export type CancelCause =
  | { kind: 'user' }
  | { kind: 'parent' }
  | { kind: 'hook'; reason: string }
  | { kind: 'disposed' }

export class Cancellation {
  private readonly controller = new AbortController()
  private _cause: CancelCause | null = null

  get signal(): AbortSignal {
    return this.controller.signal
  }

  get cause(): CancelCause | null {
    return this._cause
  }

  cancel(cause: CancelCause): void {
    if (this._cause) return
    this._cause = cause
    this.controller.abort()
  }
}

export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException('已中止', 'AbortError'))
  return new Promise((resolve, reject) => {
    const onAbort = (): void => reject(new DOMException('已中止', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

export interface TrackedProcess {
  pid: number
  kill(signal?: string): boolean
}

export class ProcessTracker {
  private readonly processes = new Map<number, TrackedProcess>()

  track(process: TrackedProcess): () => void {
    this.processes.set(process.pid, process)
    return () => this.processes.delete(process.pid)
  }

  killAll(signal = 'SIGTERM'): number {
    let killed = 0
    for (const process of [...this.processes.values()]) {
      if (process.kill(signal)) killed += 1
    }
    this.processes.clear()
    return killed
  }
}
