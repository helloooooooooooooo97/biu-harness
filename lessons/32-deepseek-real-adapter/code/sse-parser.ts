/** SseParser：把网络分片缓冲成完整 SSE 事件（复用第 07 课）。 */

export interface SseEvent {
  data: string
}

export class SseParser {
  private buffer = ''

  push(chunk: string): SseEvent[] {
    this.buffer += chunk
    const out: SseEvent[] = []
    let match: RegExpMatchArray | null
    while ((match = this.buffer.match(/\r?\n\r?\n/)) && match.index != null) {
      const raw = this.buffer.slice(0, match.index)
      this.buffer = this.buffer.slice(match.index + match[0].length)
      const event = SseParser.parseEvent(raw)
      if (event) out.push(event)
    }
    return out
  }

  flush(): SseEvent[] {
    const event = SseParser.parseEvent(this.buffer)
    this.buffer = ''
    return event ? [event] : []
  }

  private static parseEvent(raw: string): SseEvent | null {
    const data = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
    return data ? { data } : null
  }
}
