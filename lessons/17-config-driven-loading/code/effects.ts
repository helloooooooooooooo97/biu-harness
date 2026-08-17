/** EffectRegistry：可逆 effect 记账本（复用第 16 课实现）。 */

export type Disposer = () => void

export class EffectRegistry {
  private readonly effects: Array<() => void> = []

  register(fn: () => void): Disposer {
    this.effects.push(fn)
    return () => this.dispose(fn)
  }

  private dispose(fn: () => void): void {
    const index = this.effects.indexOf(fn)
    if (index < 0) return
    this.effects.splice(index, 1)
    fn()
  }

  disposeAll(): void {
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const fn = this.effects[i]
      this.effects.splice(i, 1)
      fn()
    }
  }
}
