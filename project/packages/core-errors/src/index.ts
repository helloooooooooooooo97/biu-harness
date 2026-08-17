/** 错误分类与分类重试（第 33 课）。 */

export type ErrorCategory =
  | 'auth'
  | 'rate-limit'
  | 'timeout'
  | 'network'
  | 'bad-request'
  | 'server'
  | 'unknown'

export function classifyError(error: unknown): ErrorCategory {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('HTTP 401') || message.includes('HTTP 403')) return 'auth'
  if (message.includes('HTTP 429')) return 'rate-limit'
  if (message.includes('超时')) return 'timeout'
  if (message.includes('fetch failed') || message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
    return 'network'
  }
  if (/HTTP 4\d\d/.test(message)) return 'bad-request'
  if (/HTTP 5\d\d/.test(message)) return 'server'
  return 'unknown'
}

export function isRetryable(category: ErrorCategory): boolean {
  return category === 'rate-limit'
    || category === 'timeout'
    || category === 'network'
    || category === 'server'
}

export async function retryClassified<T>(fn: () => Promise<T>, options: { attempts: number; backoffMs?: number }): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < options.attempts - 1) {
        if (!isRetryable(classifyError(error))) throw error
        if (options.backoffMs) await new Promise((resolve) => setTimeout(resolve, options.backoffMs))
      }
    }
  }
  throw lastError
}
