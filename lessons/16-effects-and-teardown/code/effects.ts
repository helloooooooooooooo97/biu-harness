/**
 * EffectRegistry：可逆 effect 记账本。
 * 三不变量：注册即可逆、disposer 幂等、disposeAll 逆序。
 */

export type Disposer = () => void

export class EffectRegistry {
  private readonly effects: Array<() => void> = []

  register(fn: () => void): Disposer {
    this.effects.push(fn)
    return () => this.dispose(fn)
  }

  /** 幂等卸载：已移除的 effect 不会重复执行。 */
  private dispose(fn: () => void): void {
    const index = this.effects.indexOf(fn)
    if (index < 0) return
    this.effects.splice(index, 1)
    fn()
  }

  /** 逆序释放全部（后注册的先清理——依赖者先于被依赖者）。 */
  disposeAll(): void {
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const fn = this.effects[i]
      this.effects.splice(i, 1)
      fn()
    }
  }

  get size(): number {
    return this.effects.length
  }
}
