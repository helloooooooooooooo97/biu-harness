/** Context（精简版）：服务注册与按名取服务。 */

export class Context {
  private readonly services = new Map<string, unknown>()
  private readonly disposers: Array<() => void> = []

  provide(name: string, impl: unknown): () => void {
    if (this.services.has(name)) throw new Error(`服务已存在: ${name}`)
    this.services.set(name, impl)
    const disposer = () => {
      this.services.delete(name)
    }
    this.disposers.push(disposer)
    return () => {
      const index = this.disposers.indexOf(disposer)
      if (index >= 0) this.disposers.splice(index, 1)
      disposer()
    }
  }

  get<T = unknown>(name: string): T {
    if (!this.services.has(name)) throw new Error(`缺少服务: ${name}`)
    return this.services.get(name) as T
  }

  has(name: string): boolean {
    return this.services.has(name)
  }

  get serviceNames(): string[] {
    return [...this.services.keys()]
  }

  /** 逆序卸载所有服务（依赖者先于被依赖者）。 */
  stop(): void {
    for (let i = this.disposers.length - 1; i >= 0; i -= 1) {
      this.disposers[i]()
      this.disposers.splice(i, 1)
    }
  }
}
