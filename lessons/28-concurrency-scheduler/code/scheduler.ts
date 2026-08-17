/**
 * 并发调度：mapLimit（限制并发）+ runSerial（严格串行）+ Barrier（组同步）。
 */

/** rolling pool：最多 limit 个并发，结果按输入顺序返回。 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await fn(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

/** 严格串行（Code Mode 子调用：顺序敏感）。 */
export function runSerial<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  return mapLimit(items, 1, fn)
}

/** 组同步：等 count 次 arrive 后放行所有 wait。 */
export class Barrier {
  private current: number
  private waiters: Array<() => void> = []

  constructor(count: number) {
    this.current = count
  }

  arrive(): void {
    this.current -= 1
    if (this.current <= 0) {
      for (const resolve of this.waiters) resolve()
      this.waiters = []
    }
  }

  wait(): Promise<void> {
    if (this.current <= 0) return Promise.resolve()
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  get remaining(): number {
    return this.current
  }
}
