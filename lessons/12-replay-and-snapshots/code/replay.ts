/**
 * 重放引擎 + golden transcript 校验。
 */
import { readFileSync } from 'node:fs'
import type { SessionEvent } from './session.ts'
import { MessageDeriver, type DerivedMessage } from './derive-messages.ts'

/** 解析 JSONL 文本（逐行容错）。 */
export function parseJsonl(text: string): SessionEvent[] {
  const events: SessionEvent[] = []
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    if (!raw.trim()) continue
    try {
      events.push({ ...JSON.parse(raw) as Record<string, unknown>, line: index + 1 } as unknown as SessionEvent)
    } catch {
      events.push({ line: index + 1, kind: 'unparsed', time: '', data: { raw: raw.slice(0, 120) } } as unknown as SessionEvent)
    }
  }
  return events
}

export interface ReplayResult {
  events: SessionEvent[]
  messages: DerivedMessage[]
}

export class ReplayEngine {
  constructor(private readonly deriver: MessageDeriver = new MessageDeriver()) {}

  /** 校验 seq 从 1 连续递增到 n——日志完整性的硬约束。 */
  assertContiguous(events: readonly SessionEvent[]): void {
    for (let i = 0; i < events.length; i += 1) {
      if (events[i].seq !== i + 1) {
        throw new Error(`seq 不连续: 第 ${i + 1} 条期望 ${i + 1}，实际 ${events[i].seq}`)
      }
    }
  }

  /** 从快照恢复事件并推导模型消息。 */
  replay(snapshot: string): ReplayResult {
    const events = JSON.parse(snapshot) as SessionEvent[]
    this.assertContiguous(events)
    return { events, messages: this.deriver.derive(events) }
  }

  /** golden 校验：日志推导出的 messages 必须与期望逐字节一致。 */
  verifyGolden(events: readonly SessionEvent[], expected: DerivedMessage[]): boolean {
    return JSON.stringify(this.deriver.derive(events)) === JSON.stringify(expected)
  }

  /** 加载 golden 对：事件 JSONL + 期望 messages JSON。 */
  loadGolden(eventsPath: string, expectedPath: string): { events: SessionEvent[]; expected: DerivedMessage[] } {
    const events = parseJsonl(readFileSync(eventsPath, 'utf8'))
    this.assertContiguous(events)
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8')) as DerivedMessage[]
    return { events, expected }
  }
}
