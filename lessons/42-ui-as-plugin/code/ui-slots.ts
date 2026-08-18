/** ui-slots：keyed renderer 注册表（第 42 课）。 */

export interface Renderer {
  render(data?: unknown): string
}

export class SlotRegistry {
  private readonly slots = new Map<string, Renderer>()

  register(key: string, renderer: Renderer): () => void {
    if (this.slots.has(key)) throw new Error(`组件已存在: ${key}`)
    this.slots.set(key, renderer)
    return () => this.slots.delete(key)
  }

  render(key: string, data?: unknown): string {
    const renderer = this.slots.get(key)
    if (!renderer) throw new Error(`缺少组件: ${key}`)
    return renderer.render(data)
  }

  list(): string[] {
    return [...this.slots.keys()]
  }
}

/** 客户端 HMR：换 renderer 不刷新页面。 */
export class ClientHmr {
  constructor(private readonly slots: SlotRegistry) {}

  reload(key: string, renderer: Renderer): () => void {
    const old = this.slots.list().includes(key) ? key : null
    if (old === null) throw new Error(`无法热替换未注册组件: ${key}`)
    // 卸载旧 renderer（重新注册前先删）
    const temp = this.slots as unknown as { slots: Map<string, Renderer> }
    temp.slots.delete(key)
    return this.slots.register(key, renderer)
  }
}
