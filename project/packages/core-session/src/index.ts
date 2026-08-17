/**
 * core-session：append-only 会话日志 + 事件域守卫 + derive（第 09/10/21 课）。
 */

export const DURABLE_KINDS = [
  'turn/start',
  'turn/end',
  'step/start',
  'step/end',
  'user/message',
  'assistant/chunk',
  'assistant/message',
  'tool/call',
  'tool/result',
  'todo/write',
] as const

export interface SessionEvent {
  seq: number
  kind: string
  data: Record<string, unknown>
}

export class SessionLog {
  private readonly events: SessionEvent[] = []
  private nextSeq = 1

  append(kind: string, data: Record<string, unknown>): SessionEvent {
    if (!(DURABLE_KINDS as readonly string[]).includes(kind)) {
      throw new Error(`非 durable 事件不能写进会话日志: ${kind}`)
    }
    const event: SessionEvent = { seq: this.nextSeq, kind, data }
    this.nextSeq += 1
    this.events.push(event)
    return event
  }

  get all(): readonly SessionEvent[] {
    return this.events
  }

  get length(): number {
    return this.events.length
  }

  snapshot(): string {
    return JSON.stringify(this.events)
  }

  static replay(snapshot: string): SessionEvent[] {
    return JSON.parse(snapshot) as SessionEvent[]
  }
}

export interface DerivedToolCall {
  id: string
  name: string
  arguments: string
}

export interface DerivedMessage {
  role: 'user' | 'assistant' | 'tool'
  content?: string
  toolCalls?: DerivedToolCall[]
  toolCallId?: string
}

const SKIPPED_KINDS = new Set([
  'turn/start',
  'turn/end',
  'step/start',
  'step/end',
  'assistant/chunk',
  'todo/write',
])

/** 日志 → 模型消息的确定性查询（纯函数）。 */
export class MessageDeriver {
  derive(events: readonly SessionEvent[], options: { afterSeq?: number } = {}): DerivedMessage[] {
    const out: DerivedMessage[] = []
    for (const ev of events) {
      if (options.afterSeq != null && (ev.seq ?? 0) <= options.afterSeq) continue
      if (SKIPPED_KINDS.has(ev.kind)) continue
      if (ev.kind === 'user/message') {
        out.push({ role: 'user', content: MessageDeriver.textOf(ev.data?.content) })
      } else if (ev.kind === 'assistant/message') {
        out.push(MessageDeriver.assistantMessage(ev))
      } else if (ev.kind === 'tool/result') {
        out.push(MessageDeriver.toolResult(ev))
      }
    }
    return out
  }

  private static assistantMessage(ev: SessionEvent): DerivedMessage {
    const msg = (ev.data?.message ?? {}) as { content?: unknown }
    return { role: 'assistant', content: MessageDeriver.textOf(msg.content) }
  }

  private static toolResult(ev: SessionEvent): DerivedMessage {
    const d = ev.data ?? {}
    const msg = (d.message ?? {}) as { content?: unknown }
    return {
      role: 'tool',
      toolCallId: String(d.callId ?? ''),
      content: MessageDeriver.textOf(msg.content),
    }
  }

  private static textOf(content: unknown): string {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .map((b) => {
          const block = b as { type?: string; text?: string }
          return block.type === 'text' ? (block.text ?? '') : ''
        })
        .filter(Boolean)
        .join(' ')
    }
    return ''
  }
}
