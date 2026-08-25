import type { SessionEvent } from './session-types.ts'

export const DEFAULT_TAIL_TURNS = 24

export interface SessionWindow {
  events: SessionEvent[]
  hasMore: boolean
  totalTurns: number
  totalEvents: number
  oldestSeq: number | null
  newestSeq: number | null
}

/** 连续 chunk 合并，并丢掉已被 assistant/message 覆盖的 chunk（瘦 API 载荷）。 */
export function compactSessionEvents(events: SessionEvent[]): SessionEvent[] {
  const coalesced: SessionEvent[] = []
  for (const event of events) {
    if (event.type === 'assistant/chunk') {
      const prev = coalesced.at(-1)
      if (prev?.type === 'assistant/chunk') {
        coalesced[coalesced.length - 1] = {
          ...prev,
          text: prev.text + event.text,
          ts: event.ts,
        }
        continue
      }
    }
    coalesced.push(event)
  }
  const out: SessionEvent[] = []
  for (let i = 0; i < coalesced.length; i++) {
    const event = coalesced[i]!
    const next = coalesced[i + 1]
    if (event.type === 'assistant/chunk' && next?.type === 'assistant/message') continue
    out.push(event)
  }
  return out
}

function turnBoundaryIndexes(events: SessionEvent[]): number[] {
  const starts: number[] = []
  const users: number[] = []
  for (let i = 0; i < events.length; i++) {
    const type = events[i]!.type
    if (type === 'turn/start') starts.push(i)
    else if (type === 'user/message') users.push(i)
  }
  // 有 turn/start 时以它为准，避免再把 user/message 算成第二轮
  return starts.length ? starts : users
}

function preambleBefore(events: SessionEvent[], startIndex: number): SessionEvent[] {
  const head: SessionEvent[] = []
  let lastPrompt: SessionEvent | undefined
  for (let i = 0; i < startIndex; i++) {
    const event = events[i]!
    if (event.type === 'session/open') head.push(event)
    else if (event.type === 'system/prompt') lastPrompt = event
  }
  if (lastPrompt) head.push(lastPrompt)
  return head
}

function meta(events: SessionEvent[], hasMore: boolean, totalTurns: number, totalEvents: number): SessionWindow {
  return {
    events,
    hasMore,
    totalTurns,
    totalEvents,
    oldestSeq: events[0]?.seq ?? null,
    newestSeq: events.at(-1)?.seq ?? null,
  }
}

/** 取末尾 limitTurns 个 turn（含 preamble）；limitTurns<=0 表示全量。 */
export function sliceTailTurns(raw: SessionEvent[], limitTurns: number): SessionWindow {
  const events = compactSessionEvents(raw)
  const totalEvents = events.length
  const boundaries = turnBoundaryIndexes(events)
  const totalTurns = boundaries.length
  if (limitTurns <= 0 || totalTurns <= limitTurns) {
    return meta(events, false, totalTurns, totalEvents)
  }
  const startIndex = boundaries[totalTurns - limitTurns]!
  const windowEvents = [...preambleBefore(events, startIndex), ...events.slice(startIndex)]
  return meta(windowEvents, true, totalTurns, totalEvents)
}

/** 取 beforeSeq 之前的更早 turn 窗口。 */
export function sliceBeforeTurns(raw: SessionEvent[], beforeSeq: number, limitTurns: number): SessionWindow {
  const all = compactSessionEvents(raw)
  const events = all.filter((event) => event.seq < beforeSeq)
  const totalEvents = all.length
  const totalTurns = turnBoundaryIndexes(all).length
  const boundaries = turnBoundaryIndexes(events)
  if (limitTurns <= 0 || boundaries.length <= limitTurns) {
    return meta(events, false, totalTurns, totalEvents)
  }
  const startIndex = boundaries[boundaries.length - limitTurns]!
  const windowEvents = [...preambleBefore(events, startIndex), ...events.slice(startIndex)]
  return meta(windowEvents, startIndex > 0, totalTurns, totalEvents)
}
