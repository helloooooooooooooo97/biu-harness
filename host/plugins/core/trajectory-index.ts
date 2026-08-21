import type { SessionEvent } from './session-types.ts'
import { compactSessionEvents, sliceBeforeTurns, sliceTailTurns } from './session-window.ts'
import { deriveMessages } from './sessions.ts'
import type { LlmMessage } from '../orchestration/llm.ts'

export interface TrajectoryUsage {
  inputTokens: number
  outputTokens: number
  totalTokens?: number
  cacheReadTokens?: number
}

/** 列表行：只有摘要，不含全文 body。 */
export interface TrajectoryRow {
  id: string
  seq: number
  turn: number | null
  step: number | null
  depth: 0 | 1 | 2
  type: SessionEvent['type']
  summary: string
  usage?: TrajectoryUsage
  callId?: string
}

function assistantSummary(event: Extract<SessionEvent, { type: 'assistant/message' }>): string {
  const tools = event.tool_calls?.length ?? 0
  if (event.text.trim()) return event.text.slice(0, 160)
  if (tools) {
    const names = event.tool_calls!.map((call) => call.name).join(', ')
    return `→ ${tools} tool call${tools > 1 ? 's' : ''}: ${names}`
  }
  return '(empty assistant message)'
}

export function projectTrajectoryRows(events: SessionEvent[]): TrajectoryRow[] {
  let turn: number | null = null
  let step: number | null = null
  let inStep = false
  const rows: TrajectoryRow[] = []
  for (const event of events) {
    if (event.type === 'turn/start') {
      turn = event.turn
      step = null
      inStep = false
    }
    if (event.type === 'session/open' || event.type === 'assistant/chunk') continue
    if (event.type === 'step/start') {
      step = event.step
      inStep = true
    }

    let summary: string = event.type
    let callId: string | undefined
    let usage: TrajectoryUsage | undefined
    if (event.type === 'assistant/message') {
      summary = assistantSummary(event)
      usage = event.usage
    } else if (event.type === 'user/message' || event.type === 'system/prompt') {
      summary = event.text.slice(0, 160)
    } else if (event.type === 'tool/call') {
      callId = event.id
      summary = `${event.name}(${event.arguments.slice(0, 80)})`
    } else if (event.type === 'tool/result') {
      callId = event.id
      summary = `${event.name} → ${event.ok ? 'ok' : 'fail'}: ${event.detail.slice(0, 80)}`
    } else if (event.type === 'turn/end') {
      summary = `end · ${event.reason}`
    } else if (event.type === 'step/start' || event.type === 'step/end') {
      summary = `step ${event.step}`
    }

    const depth: 0 | 1 | 2 =
      event.type === 'step/start' || event.type === 'step/end'
        ? 1
        : inStep && event.type !== 'turn/end'
          ? 2
          : 0

    rows.push({
      id: `tr-${event.seq}`,
      seq: event.seq,
      turn,
      step: event.type === 'step/start' || event.type === 'step/end' || inStep ? step : null,
      depth,
      type: event.type,
      summary,
      usage,
      callId,
    })

    if (event.type === 'step/end') {
      inStep = false
      step = null
    }
    if (event.type === 'turn/end') {
      turn = null
      step = null
      inStep = false
    }
  }
  return rows
}

export const DEFAULT_TRAJECTORY_TURNS = 48

export function buildTrajectoryWindow(raw: SessionEvent[], limitTurns: number) {
  const window = sliceTailTurns(raw, limitTurns)
  return {
    rows: projectTrajectoryRows(window.events),
    hasMore: window.hasMore,
    totalTurns: window.totalTurns,
    totalEvents: window.totalEvents,
    oldestSeq: window.oldestSeq,
    newestSeq: window.newestSeq,
  }
}

export function buildTrajectoryBefore(raw: SessionEvent[], beforeSeq: number, limitTurns: number) {
  const window = sliceBeforeTurns(raw, beforeSeq, limitTurns)
  return {
    rows: projectTrajectoryRows(window.events),
    hasMore: window.hasMore,
    totalTurns: window.totalTurns,
    totalEvents: window.totalEvents,
    oldestSeq: window.oldestSeq,
    newestSeq: window.newestSeq,
  }
}

/** 单条事件详情（已 compact 视图：chunk 仍原样返回若仍在盘上）。 */
export function findEvent(raw: SessionEvent[], seq: number): SessionEvent | undefined {
  return compactSessionEvents(raw).find((event) => event.seq === seq) ?? raw.find((event) => event.seq === seq)
}

export function buildRequestMessages(raw: SessionEvent[], assistantSeq: number): LlmMessage[] {
  const events = compactSessionEvents(raw).filter((event) => event.seq < assistantSeq)
  return deriveMessages(events)
}
