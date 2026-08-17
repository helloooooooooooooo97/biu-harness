/**
 * SseParser：把网络分片缓冲成完整的 SSE 事件。
 * SSE 事件以空行（\n\n 或 \r\n\r\n）分隔；data: 行可能跨分片。
 */
export interface SseEvent {
  data: string
}

export class SseParser {
  private buffer = ''

  /** 喂入一段文本，返回这次能切出的完整事件。 */
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

  /** 流结束时把残留缓冲也解析掉（最后一段可能没有尾随空行）。 */
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
