/** UI 组件即插件：keyed renderer + 客户端 HMR（第 42 课）。 */

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

export class ClientHmr {
  constructor(private readonly slots: SlotRegistry) {}

  reload(key: string, renderer: Renderer): () => void {
    if (!this.slots.list().includes(key)) throw new Error(`无法热替换未注册组件: ${key}`)
    const inner = this.slots as unknown as { slots: Map<string, Renderer> }
    inner.slots.delete(key)
    return this.slots.register(key, renderer)
  }
}

export interface SessionEventLike {
  kind: string
  data: Record<string, unknown>
}

export class ConversationNodeAssembler {
  constructor(private readonly slots: SlotRegistry) {}

  renderEvent(event: SessionEventLike): string {
    return this.slots.render(event.kind.startsWith('tool/') ? 'tool' : 'message', event.data)
  }
}
