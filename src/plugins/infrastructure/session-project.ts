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
  | {
      type: 'assistant/message'
      text: string
      tool_calls?: Array<{ id: string; name: string; arguments: string }>
      usage?: {
        inputTokens: number
        outputTokens: number
        totalTokens?: number
        cacheReadTokens?: number
      }
    }
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

/** 与 host deriveMessages 对齐：从事件日志投影模型可见 messages。 */
export interface DerivedMessage {
  role: string
  content?: string | null
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

function assistantContentForApi(text: string | undefined | null, hasToolCalls: boolean): string | null {
  if (hasToolCalls && !text) return null
  return text ?? null
}

export function deriveMessages(events: SessionEvent[]): DerivedMessage[] {
  let system = ''
  const messages: DerivedMessage[] = []
  for (const event of events) {
    if (event.type === 'system/prompt') {
      system = event.text
    } else if (event.type === 'user/message') {
      messages.push({ role: 'user', content: event.text })
    } else if (event.type === 'assistant/message') {
      const hasToolCalls = Boolean(event.tool_calls?.length)
      messages.push({
        role: 'assistant',
        content: assistantContentForApi(event.text, hasToolCalls),
        ...(hasToolCalls
          ? {
              tool_calls: event.tool_calls!.map((call) => ({
                id: call.id,
                type: 'function',
                function: { name: call.name, arguments: call.arguments },
              })),
            }
          : {}),
      })
    } else if (event.type === 'tool/result') {
      messages.push({ role: 'tool', tool_call_id: event.id, content: event.detail })
    }
  }
  return system ? [{ role: 'system', content: system }, ...messages] : messages
}

/** 某条 assistant/message 发起 llm.chat 时的 request = 其 seq 之前的事件投影。 */
export function projectRequestMessages(events: SessionEvent[], assistantSeq: number): DerivedMessage[] {
  return deriveMessages(events.filter((event) => event.seq < assistantSeq))
}

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
export interface TrajectoryUsage {
  inputTokens: number
  outputTokens: number
  totalTokens?: number
  cacheReadTokens?: number
}

export interface TrajectoryRow {
  id: string
  seq: number
  turn: number | null
  step: number | null
  /** 0=turn 级，1=step 边界，2=step 内事件 */
  depth: 0 | 1 | 2
  type: SessionEvent['type']
  summary: string
  usage?: TrajectoryUsage
  callId?: string
}

export function formatTrajectoryUsage(usage: TrajectoryUsage | undefined): string {
  if (!usage) return ''
  const parts = [`${usage.inputTokens}→${usage.outputTokens}`]
  if (usage.cacheReadTokens) parts.push(`c${usage.cacheReadTokens}`)
  return parts.join(' ')
}

export function sumTrajectoryUsage(events: SessionEvent[]): TrajectoryUsage | undefined {
  let input = 0
  let output = 0
  let total = 0
  let cache = 0
  let hit = false
  for (const event of events) {
    if (event.type !== 'assistant/message' || !event.usage) continue
    hit = true
    input += event.usage.inputTokens
    output += event.usage.outputTokens
    total += event.usage.totalTokens ?? event.usage.inputTokens + event.usage.outputTokens
    cache += event.usage.cacheReadTokens ?? 0
  }
  if (!hit) return undefined
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: total,
    ...(cache ? { cacheReadTokens: cache } : {}),
  }
}

/** 从 Trajectory 行汇总 usage（避免为了合计去订阅整份 events，chunk 流式时少重绘）。 */
export function sumTrajectoryRowUsage(rows: Array<{ usage?: TrajectoryUsage }>): TrajectoryUsage | undefined {
  let input = 0
  let output = 0
  let total = 0
  let cache = 0
  let hit = false
  for (const row of rows) {
    if (!row.usage) continue
    hit = true
    input += row.usage.inputTokens
    output += row.usage.outputTokens
    total += row.usage.totalTokens ?? row.usage.inputTokens + row.usage.outputTokens
    cache += row.usage.cacheReadTokens ?? 0
  }
  if (!hit) return undefined
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: total,
    ...(cache ? { cacheReadTokens: cache } : {}),
  }
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

/**
 * 前端事件压缩（对齐 dsh：chunk 仅服务流式投影，不膨胀 UI 账本）。
 * - 连续 `assistant/chunk` 合并为一条
 * - 已被同段 `assistant/message` 覆盖的 chunk 丢弃（message 为权威全文）
 * 不改 host append-only 落盘；仅瘦客户端内存视图。
 */
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
    // 与 dsh ConversationNode / deriveMessages 一致：chunk 不进轨迹行（流式只在 Chat 合并）
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
