/** 按错误分类重试：只重试可恢复错误（第 33 课）。 */
import { classifyError, isRetryable } from './errors.ts'

export interface ClassifiedRetryOptions {
  attempts: number
  backoffMs?: number
}

export async function retryClassified<T>(fn: () => Promise<T>, options: ClassifiedRetryOptions): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < options.attempts - 1) {
        if (!isRetryable(classifyError(error))) throw error
        if (options.backoffMs) {
          await new Promise((resolve) => setTimeout(resolve, options.backoffMs))
        }
      }
    }
  }
  throw lastError
}
