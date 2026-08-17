/** MessageDeriver：把会话日志投影成模型请求的 messages（纯函数）。 */
import type { SessionEvent } from './session.ts'

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

export interface DeriveOptions {
  afterSeq?: number
}

const SKIPPED_KINDS = new Set([
  'turn/start',
  'turn/end',
  'step/start',
  'step/end',
  'assistant/chunk',
  'todo/write',
  'request/header',
  'request/context',
  'compaction/start',
  'compaction/summary',
  'compaction/end',
])

export class MessageDeriver {
  derive(events: readonly SessionEvent[], options: DeriveOptions = {}): DerivedMessage[] {
    const out: DerivedMessage[] = []
    for (const ev of events) {
      if (options.afterSeq != null && (ev.seq ?? 0) <= options.afterSeq) continue
      if (SKIPPED_KINDS.has(ev.kind)) continue
      if (ev.kind === 'unparsed') continue
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
    const msg = (ev.data?.message ?? {}) as {
      content?: unknown
      tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>
    }
    const toolCalls = MessageDeriver.toolCallsOf(msg)
    const message: DerivedMessage = { role: 'assistant', content: MessageDeriver.textOf(msg.content) }
    if (toolCalls.length) message.toolCalls = toolCalls
    return message
  }

  private static toolCallsOf(msg: {
    content?: unknown
    tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>
  }): DerivedToolCall[] {
    const out: DerivedToolCall[] = []
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        const b = block as { type?: string; id?: string; name?: string; arguments?: string }
        if (b.type === 'tool-call') {
          out.push({ id: String(b.id ?? ''), name: String(b.name ?? ''), arguments: String(b.arguments ?? '') })
        }
      }
    }
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        out.push({
          id: String(tc.id ?? ''),
          name: String(tc.function?.name ?? ''),
          arguments: String(tc.function?.arguments ?? ''),
        })
      }
    }
    return out
  }

  private static toolResult(ev: SessionEvent): DerivedMessage {
    const d = ev.data ?? {}
    const msg = (d.message ?? {}) as { content?: unknown }
    return {
      role: 'tool',
      toolCallId: String(d.callId ?? d.toolCallId ?? ''),
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
