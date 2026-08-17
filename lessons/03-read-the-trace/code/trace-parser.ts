/**
 * 会话日志解析器（TS + OOD 版）：JSONL 事件流 → 统计 / CSV / JSON。
 *
 * 用法：
 *   npx tsx trace-parser.ts sample-session.jsonl --summary
 *   npx tsx trace-parser.ts sample-session.jsonl --csv
 *   npx tsx trace-parser.ts sample-session.jsonl --json
 */
import { readFileSync } from 'node:fs'

export interface SessionEvent {
  seq?: number
  time?: string
  kind: string
  data?: Record<string, unknown>
  line: number
  error?: string
}

export interface Summary {
  turns: number
  steps: number
  userMessages: number
  assistantMessages: number
  assistantChunks: number
  toolCalls: number
  toolResults: number
  unparsed: number
  token: { prompt: number; completion: number; total: number }
}

export interface Row {
  line: number
  time: string
  kind: string
  turn: number | string
  step: number | string
  detail: string
}

const USAGE_ALIASES = [
  ['promptTokens', 'prompt_tokens'],
  ['completionTokens', 'completion_tokens'],
  ['totalTokens', 'total_tokens'],
] as const

/** 解析 JSONL 文本，逐行容错（坏行标记为 unparsed，不中断）。 */
export class TraceParser {
  parse(text: string): SessionEvent[] {
    return text
      .split(/\r?\n/)
      .map((raw, index) => {
        const line = index + 1
        if (!raw.trim()) return null
        try {
          return { ...JSON.parse(raw) as object, line } as SessionEvent
        } catch (err) {
          return {
            line,
            kind: 'unparsed',
            time: '',
            data: { raw: raw.slice(0, 120) },
            error: String(err),
          } satisfies SessionEvent
        }
      })
      .filter((ev): ev is SessionEvent => ev !== null)
  }

  /** 汇总统计：turn/step/消息/工具/token。 */
  summarize(events: SessionEvent[]): Summary {
    const s: Summary = {
      turns: 0,
      steps: 0,
      userMessages: 0,
      assistantMessages: 0,
      assistantChunks: 0,
      toolCalls: 0,
      toolResults: 0,
      unparsed: 0,
      token: { prompt: 0, completion: 0, total: 0 },
    }
    for (const ev of events) {
      switch (ev.kind) {
        case 'turn/start': s.turns += 1; break
        case 'step/start': s.steps += 1; break
        case 'user/message': s.userMessages += 1; break
        case 'assistant/chunk': s.assistantChunks += 1; break
        case 'assistant/message': {
          s.assistantMessages += 1
          const usage = TraceParser.usageOf(ev.data)
          s.token.prompt += usage.promptTokens ?? 0
          s.token.completion += usage.completionTokens ?? 0
          s.token.total += usage.totalTokens ?? 0
          break
        }
        case 'tool/call': s.toolCalls += 1; break
        case 'tool/result': s.toolResults += 1; break
        case 'unparsed': s.unparsed += 1; break
      }
    }
    return s
  }

  /** 拍平成行，供 CSV/JSON 使用。 */
  rows(events: SessionEvent[]): Row[] {
    return events.map((ev) => ({
      line: ev.line,
      time: ev.time ?? '',
      kind: ev.kind ?? 'unparsed',
      turn: TraceParser.dataOf(ev, 'turn') ?? '',
      step: TraceParser.dataOf(ev, 'step') ?? '',
      detail: TraceParser.detailOf(ev),
    }))
  }

  toCsv(rowList: Row[]): string {
    const header = ['line', 'time', 'kind', 'turn', 'step', 'detail'] as const
    const escape = (v: unknown): string => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [header.join(',')]
    for (const r of rowList) {
      lines.push(header.map((k) => escape(r[k])).join(','))
    }
    return lines.join('\n')
  }

  toJson(rowList: Row[]): string {
    return JSON.stringify(rowList, null, 2)
  }

  private static usageOf(data?: Record<string, unknown>): Record<string, number> {
    const usage = (data?.usage ?? {}) as Record<string, number>
    const out: Record<string, number> = {}
    for (const [a, b] of USAGE_ALIASES) {
      if (usage[a] != null || usage[b] != null) out[a] = usage[a] ?? usage[b]
    }
    return out
  }

  private static dataOf(ev: SessionEvent, key: string): number | string | undefined {
    const value = ev.data?.[key]
    return typeof value === 'number' || typeof value === 'string' ? value : undefined
  }

  private static detailOf(ev: SessionEvent): string {
    const d = ev.data ?? {}
    switch (ev.kind) {
      case 'user/message':
        return String(d.content ?? '').slice(0, 80)
      case 'assistant/chunk':
        return String(TraceParser.chunkText(d.chunk)).slice(0, 80)
      case 'assistant/message': {
        const text = TraceParser.contentText(TraceParser.messageOf(d)?.content)
        return (text || JSON.stringify(d.message ?? '')).slice(0, 80)
      }
      case 'tool/call':
        return `${String(d.name ?? '')}(${String(d.arguments ?? '').slice(0, 60)})`
      case 'tool/result': {
        const msg = TraceParser.messageOf(d)
        const text = TraceParser.contentText(msg?.content)
        return `${text.slice(0, 60)}${msg?.isError ? ' [error]' : ''}`
      }
      default:
        return ''
    }
  }

  private static messageOf(d: Record<string, unknown>): { content?: unknown; isError?: boolean } | undefined {
    return d.message as { content?: unknown; isError?: boolean } | undefined
  }

  private static chunkText(chunk: unknown): string {
    if (chunk && typeof chunk === 'object' && 'text' in chunk) {
      return String((chunk as { text: unknown }).text)
    }
    return JSON.stringify(chunk ?? '')
  }

  private static contentText(content: unknown): string {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .map((b) => (b && typeof b === 'object' && (b as { type?: string }).type === 'text'
          ? String((b as { text?: unknown }).text ?? '')
          : ''))
        .filter(Boolean)
        .join(' ')
    }
    return ''
  }
}

function main(): void {
  const [file, flag] = process.argv.slice(2)
  if (!file) {
    console.error('用法: npx tsx trace-parser.ts <file.jsonl> [--summary|--csv|--json]')
    process.exit(1)
  }
  const parser = new TraceParser()
  const events = parser.parse(readFileSync(file, 'utf8'))
  const format = flag === '--csv' || flag === '--json' ? flag : '--summary'
  if (format === '--summary') {
    console.log(JSON.stringify(parser.summarize(events), null, 2))
    return
  }
  const rowList = parser.rows(events)
  console.log(format === '--csv' ? parser.toCsv(rowList) : parser.toJson(rowList))
}

const isMain = process.argv[1]
  && import.meta.url === new URL(process.argv[1], 'file:').href
if (isMain) main()
