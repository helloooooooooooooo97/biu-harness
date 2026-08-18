/** ConversationNode：业务事件 → keyed 组件（第 42 课）。 */
import type { Renderer, SlotRegistry } from './ui-slots.ts'

export interface ConversationNodeDefinition {
  key: string
  render: Renderer['render']
}

export interface SessionEventLike {
  kind: string
  data: Record<string, unknown>
}

/** 事件 → 节点数据的组装器（从 durable 事件渲染，组件不记状态）。 */
export class ConversationNodeAssembler {
  constructor(private readonly slots: SlotRegistry) {}

  register(def: ConversationNodeDefinition): () => void {
    return this.slots.register(def.key, { render: def.render })
  }

  /** 根据事件类型选择组件并渲染。 */
  renderEvent(event: SessionEventLike): string {
    const key = event.kind.startsWith('tool/') ? 'tool' : 'message'
    return this.slots.render(key, event.data)
  }
}
