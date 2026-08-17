/** 并发调度：mapLimit / runSerial / Barrier（第 28 课）。 */

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

export function runSerial<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  return mapLimit(items, 1, fn)
}

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
}
