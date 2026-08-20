/** 与 host SessionEvent 对齐的瘦客户端类型（只投影 UI 需要的字段）。 */
export type SessionEvent = {
  seq: number
  ts: number
} & (
  | { type: 'session/open'; version: number }
  | { type: 'turn/start'; turn: number }
  | { type: 'turn/end'; turn: number; reason: string }
  | { type: 'step/start'; turn: number; step: number }
  | { type: 'step/end'; turn: number; step: number }
  | { type: 'system/prompt'; text: string }
  | { type: 'user/message'; text: string; kind?: string }
  | { type: 'assistant/message'; text: string; tool_calls?: Array<{ id: string; name: string; arguments: string }> }
  | { type: 'assistant/chunk'; text: string }
  | { type: 'tool/call'; id: string; name: string; arguments: string }
  | { type: 'tool/result'; id: string; name: string; ok: boolean; detail: string }
)

/** 精简 ConversationNode：事件 → 可渲染行。 */
export type ChatNode =
  | { id: string; kind: 'user'; text: string; kindTag?: string }
  | { id: string; kind: 'assistant'; text: string; streaming?: boolean }
  | {
      id: string
      kind: 'tool'
      callId: string
      name: string
      arguments: string
      result?: { ok: boolean; detail: string }
    }
  | { id: string; kind: 'turn'; text: string }

export function projectNodes(events: SessionEvent[]): ChatNode[] {
  const nodes: ChatNode[] = []
  let streamingId: string | null = null
  const tools = new Map<string, Extract<ChatNode, { kind: 'tool' }>>()

  for (const event of events) {
    if (event.type === 'user/message') {
      streamingId = null
      nodes.push({ id: `u-${event.seq}`, kind: 'user', text: event.text, kindTag: event.kind })
    } else if (event.type === 'assistant/chunk') {
      if (streamingId) {
        const idx = nodes.findIndex((node) => node.id === streamingId)
        const current = idx >= 0 ? nodes[idx] : undefined
        if (current?.kind === 'assistant') {
          nodes[idx] = { ...current, text: current.text + event.text, streaming: true }
        }
      } else {
        streamingId = `a-${event.seq}`
        nodes.push({ id: streamingId, kind: 'assistant', text: event.text, streaming: true })
      }
    } else if (event.type === 'assistant/message') {
      if (streamingId) {
        const idx = nodes.findIndex((node) => node.id === streamingId)
        if (idx >= 0 && nodes[idx]?.kind === 'assistant') {
          nodes[idx] = { id: streamingId, kind: 'assistant', text: event.text, streaming: false }
        }
        streamingId = null
      } else if (event.text || !event.tool_calls?.length) {
        nodes.push({ id: `a-${event.seq}`, kind: 'assistant', text: event.text })
      }
    } else if (event.type === 'tool/call') {
      streamingId = null
      const node: Extract<ChatNode, { kind: 'tool' }> = {
        id: `t-${event.id}`,
        kind: 'tool',
        callId: event.id,
        name: event.name,
        arguments: event.arguments,
      }
      tools.set(event.id, node)
      nodes.push(node)
    } else if (event.type === 'tool/result') {
      const existing = tools.get(event.id)
      if (existing) {
        const next = { ...existing, result: { ok: event.ok, detail: event.detail } }
        tools.set(event.id, next)
        const idx = nodes.findIndex((node) => node.id === existing.id)
        if (idx >= 0) nodes[idx] = next
      } else {
        nodes.push({
          id: `t-${event.id}`,
          kind: 'tool',
          callId: event.id,
          name: event.name,
          arguments: '',
          result: { ok: event.ok, detail: event.detail },
        })
      }
    } else if (event.type === 'turn/end' && event.reason && event.reason !== 'complete') {
      nodes.push({ id: `turn-${event.seq}`, kind: 'turn', text: `回合结束：${event.reason}` })
    }
  }
  return nodes
}

/** Lean Trajectory 行：官方 ui-trajectory 的瘦投影，不搬虚表/搜索索引。 */
export interface TrajectoryRow {
  id: string
  seq: number
  turn: number | null
  step: number | null
  /** 0=turn 级，1=step 边界，2=step 内事件 */
  depth: 0 | 1 | 2
  type: SessionEvent['type']
  summary: string
  callId?: string
}

export function projectTrajectory(events: SessionEvent[]): TrajectoryRow[] {
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
    if (event.type === 'session/open') continue
    if (event.type === 'step/start') {
      step = event.step
      inStep = true
    }

    let summary: string = event.type
    let callId: string | undefined
    if (event.type === 'user/message' || event.type === 'assistant/message' || event.type === 'assistant/chunk' || event.type === 'system/prompt') {
      summary = event.text.slice(0, 120)
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
