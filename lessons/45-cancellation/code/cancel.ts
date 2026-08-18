/** 取消令牌：signal + cause（第 45 课）。 */

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

/** 把 promise 与取消信号绑定：取消则以 AbortError 拒绝。 */
export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException('已中止', 'AbortError'))
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      reject(new DOMException('已中止', 'AbortError'))
    }
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
