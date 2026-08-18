/** 上下文压缩：压力检测 + 裁剪 + 摘要（第 46 课）。 */

export interface MessageLike {
  role: string
  content: string
}

export interface CompactionEvent {
  kind: 'compaction/start' | 'compaction/summary' | 'compaction/end'
  data: Record<string, unknown>
}

export function estimateTokens(text: string): number {
  return Math.ceil([...text].length / 4)
}

export class PressureMonitor {
  constructor(private readonly limitTokens: number) {}

  overLimit(messages: MessageLike[]): boolean {
    return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0) > this.limitTokens
  }
}

export function pruneToolResult(text: string, maxBytes: number): string {
  if (text.length <= maxBytes) return text
  const head = Math.floor(maxBytes * 0.7)
  const tail = maxBytes - head
  return `${text.slice(0, head)}\n…[裁剪 ${text.length - maxBytes} 字符]…\n${text.slice(-tail)}`
}

export class CompactionRunner {
  constructor(
    private readonly monitor: PressureMonitor,
    private readonly maxResultBytes = 4000,
  ) {}

  compact(messages: MessageLike[]): { messages: MessageLike[]; summary: string; events: CompactionEvent[] } {
    const events: CompactionEvent[] = [{ kind: 'compaction/start', data: { count: messages.length } }]
    const pruned = messages.map((m) => ({ ...m, content: m.role === 'tool' ? pruneToolResult(m.content, this.maxResultBytes) : m.content }))
    let summary = ''
    let out = pruned
    if (this.monitor.overLimit(pruned)) {
      const oldest = pruned.slice(0, Math.max(1, Math.floor(pruned.length / 2)))
      summary = `（摘要：早期 ${oldest.length} 条消息已压缩）`
      out = [{ role: 'system', content: summary }, ...pruned.slice(oldest.length)]
      events.push({ kind: 'compaction/summary', data: { summary, removed: oldest.length } })
    }
    events.push({ kind: 'compaction/end', data: { remaining: out.length } })
    return { messages: out, summary, events }
  }
}
