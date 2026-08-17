/**
 * 超时 / 重试 / 指标（第 29 课）。
 */

/** 给异步操作设期限：超时则拒绝，不继续等。 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message = `操作超时（${ms}ms）`): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export interface RetryOptions {
  attempts: number
  backoffMs?: number
  shouldRetry?: (error: Error) => boolean
}

/** 有限次数重试：失败可分类决定是否值得重试。 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < options.attempts - 1) {
        if (options.shouldRetry && !options.shouldRetry(error as Error)) throw error
        if (options.backoffMs) {
          await new Promise((resolve) => setTimeout(resolve, options.backoffMs))
        }
      }
    }
  }
  throw lastError
}

/** 指标记账：计数（inc）与求和（add），供遥测消费。 */
export class Metrics {
  private readonly data = new Map<string, number>()

  inc(key: string, by = 1): void {
    this.data.set(key, (this.data.get(key) ?? 0) + by)
  }

  add(key: string, value: number): void {
    this.data.set(key, (this.data.get(key) ?? 0) + value)
  }

  get(key: string): number {
    return this.data.get(key) ?? 0
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.data)
  }
}
