/** 错误分类与可重试判定（第 33 课）。 */

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

/** 只重试"可能自己好的错误"。 */
export function isRetryable(category: ErrorCategory): boolean {
  return category === 'rate-limit'
    || category === 'timeout'
    || category === 'network'
    || category === 'server'
}

export function retryableReason(error: unknown): string {
  const category = classifyError(error)
  return isRetryable(category) ? `可重试（${category}）` : `不可重试（${category}）`
}
