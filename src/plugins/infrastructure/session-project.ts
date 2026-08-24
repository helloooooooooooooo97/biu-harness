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
  | {
      type: 'user/message'
      text: string
      kind?: string
      sender?: { type: 'user' } | { type: 'session'; sessionId: string }
    }
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

export interface TrajectoryUsage {
  inputTokens: number
  outputTokens: number
  totalTokens?: number
  cacheReadTokens?: number
}

/** 精简 ConversationNode：事件 → 可渲染行。 */
export type ChatToolPart = {
  id: string
  kind: 'tool'
  callId: string
  name: string
  arguments: string
  result?: { ok: boolean; detail: string }
  step?: number
}

export type ChatAssistantPart = {
  id: string
  kind: 'assistant'
  text: string
  streaming?: boolean
  step?: number
}

export type ChatReplyPart = ChatAssistantPart | ChatToolPart

/** 单步摘要：横条展示用。 */
export type ChatStepStat = {
  step: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  toolCount: number
  messageChars: number
}

export type ChatNode =
  | {
      id: string
      kind: 'user'
      text: string
      kindTag?: string
      ts?: number
      /** 缺省 / user = 真人；session = Live 等其它会话派工 */
      sender?: { type: 'user' } | { type: 'session'; sessionId: string }
    }
  | {
      id: string
      kind: 'reply'
      parts: ChatReplyPart[]
      /** 本回合所有助手正文，供一键复制 */
      copyText: string
      turn?: number
      stepCount?: number
      steps?: ChatStepStat[]
      usage?: TrajectoryUsage
      durationMs?: number
      streaming?: boolean
      finished?: boolean
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
  let turnStartTs: number | undefined
  let currentTurn: number | undefined
  let currentStep: number | undefined
  let reply: {
    id: string
    parts: ChatReplyPart[]
    streamingId: string | null
    tools: Map<string, ChatToolPart>
    usage: { input: number; output: number; total: number; cache: number; hit: boolean }
    streaming: boolean
    turn?: number
    steps: Map<number, ChatStepStat>
  } | null = null

  function ensureReply(seq: number) {
    if (!reply) {
      reply = {
        id: `r-${seq}`,
        parts: [],
        streamingId: null,
        tools: new Map(),
        usage: { input: 0, output: 0, total: 0, cache: 0, hit: false },
        // 回合未结束前保持 streaming，Details 不因中间 tool/message 收起
        streaming: currentTurn != null,
        steps: new Map(),
        ...(currentTurn != null ? { turn: currentTurn } : {}),
      }
    } else if (currentTurn != null) {
      reply.streaming = true
    }
    return reply
  }

  function ensureStepStat(step: number): ChatStepStat {
    const r = reply!
    const existing = r.steps.get(step)
    if (existing) return existing
    const next: ChatStepStat = {
      step,
      inputTokens: 0,
      outputTokens: 0,
      toolCount: 0,
      messageChars: 0,
    }
    r.steps.set(step, next)
    return next
  }

  function addUsage(usage: NonNullable<Extract<SessionEvent, { type: 'assistant/message' }>['usage']>) {
    const r = reply
    if (!r) return
    r.usage.hit = true
    r.usage.input += usage.inputTokens
    r.usage.output += usage.outputTokens
    r.usage.total += usage.totalTokens ?? usage.inputTokens + usage.outputTokens
    r.usage.cache += usage.cacheReadTokens ?? 0
    if (currentStep != null) {
      const stat = ensureStepStat(currentStep)
      stat.inputTokens += usage.inputTokens
      stat.outputTokens += usage.outputTokens
      if (usage.cacheReadTokens) {
        stat.cacheReadTokens = (stat.cacheReadTokens ?? 0) + usage.cacheReadTokens
      }
    }
  }

  function flushReply(endTs?: number, finished = false) {
    if (!reply || reply.parts.length === 0) {
      reply = null
      currentStep = undefined
      return
    }
    const copyText = reply.parts
      .filter((part): part is ChatAssistantPart => part.kind === 'assistant')
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join('\n\n')
    const usage: TrajectoryUsage | undefined = reply.usage.hit
      ? {
          inputTokens: reply.usage.input,
          outputTokens: reply.usage.output,
          totalTokens: reply.usage.total,
          ...(reply.usage.cache ? { cacheReadTokens: reply.usage.cache } : {}),
        }
      : undefined
    const durationMs =
      finished && turnStartTs != null && endTs != null ? Math.max(0, endTs - turnStartTs) : undefined
    const steps = [...reply.steps.values()].sort((a, b) => a.step - b.step)
    nodes.push({
      id: reply.id,
      kind: 'reply',
      parts: reply.parts,
      copyText,
      ...(reply.turn != null ? { turn: reply.turn } : {}),
      ...(steps.length ? { stepCount: steps.length, steps } : {}),
      ...(usage ? { usage } : {}),
      ...(durationMs != null ? { durationMs } : {}),
      streaming: reply.streaming && !finished,
      finished,
    })
    reply = null
    currentStep = undefined
  }

  for (const event of events) {
    if (event.type === 'turn/start') {
      flushReply(undefined, true)
      turnStartTs = event.ts
      currentTurn = event.turn
      currentStep = undefined
    } else if (event.type === 'step/start') {
      currentStep = event.step
      ensureReply(event.seq)
      ensureStepStat(event.step)
    } else if (event.type === 'step/end') {
      if (currentStep === event.step) currentStep = undefined
    } else if (event.type === 'user/message') {
      flushReply(undefined, true)
      nodes.push({
        id: `u-${event.seq}`,
        kind: 'user',
        text: event.text,
        kindTag: event.kind,
        ts: event.ts,
        ...(event.sender ? { sender: event.sender } : {}),
      })
    } else if (event.type === 'assistant/chunk') {
      const r = ensureReply(event.seq)
      if (r.streamingId) {
        const idx = r.parts.findIndex((part) => part.id === r.streamingId)
        const current = idx >= 0 ? r.parts[idx] : undefined
        if (current?.kind === 'assistant') {
          r.parts[idx] = {
            ...current,
            text: current.text + event.text,
            streaming: true,
            ...(currentStep != null ? { step: currentStep } : {}),
          }
        }
      } else {
        r.streamingId = `a-${event.seq}`
        r.parts.push({
          id: r.streamingId,
          kind: 'assistant',
          text: event.text,
          streaming: true,
          ...(currentStep != null ? { step: currentStep } : {}),
        })
      }
      r.streaming = true
    } else if (event.type === 'assistant/message') {
      const r = ensureReply(event.seq)
      if (event.usage) addUsage(event.usage)
      if (currentStep != null) {
        ensureStepStat(currentStep).messageChars += event.text?.length ?? 0
      }
      if (r.streamingId) {
        const idx = r.parts.findIndex((part) => part.id === r.streamingId)
        if (idx >= 0 && r.parts[idx]?.kind === 'assistant') {
          r.parts[idx] = {
            id: r.streamingId,
            kind: 'assistant',
            text: event.text,
            streaming: false,
            ...(currentStep != null ? { step: currentStep } : {}),
          }
        }
        r.streamingId = null
        // 不在这里清 reply.streaming：整轮 turn/end 前 Details 保持展开
      } else if (event.text || !event.tool_calls?.length) {
        r.parts.push({
          id: `a-${event.seq}`,
          kind: 'assistant',
          text: event.text,
          ...(currentStep != null ? { step: currentStep } : {}),
        })
      }
      if (currentTurn != null) r.streaming = true
    } else if (event.type === 'tool/call') {
      const r = ensureReply(event.seq)
      r.streamingId = null
      if (currentTurn != null) r.streaming = true
      if (currentStep != null) ensureStepStat(currentStep).toolCount += 1
      const part: ChatToolPart = {
        id: `t-${event.id}`,
        kind: 'tool',
        callId: event.id,
        name: event.name,
        arguments: event.arguments,
        ...(currentStep != null ? { step: currentStep } : {}),
      }
      r.tools.set(event.id, part)
      r.parts.push(part)
    } else if (event.type === 'tool/result') {
      const r = ensureReply(event.seq)
      if (currentTurn != null) r.streaming = true
      const existing = r.tools.get(event.id)
      if (existing) {
        const next = { ...existing, result: { ok: event.ok, detail: event.detail } }
        r.tools.set(event.id, next)
        const idx = r.parts.findIndex((part) => part.id === existing.id)
        if (idx >= 0) r.parts[idx] = next
      } else {
        if (currentStep != null) ensureStepStat(currentStep).toolCount += 1
        const part: ChatToolPart = {
          id: `t-${event.id}`,
          kind: 'tool',
          callId: event.id,
          name: event.name,
          arguments: '',
          result: { ok: event.ok, detail: event.detail },
          ...(currentStep != null ? { step: currentStep } : {}),
        }
        r.tools.set(event.id, part)
        r.parts.push(part)
      }
    } else if (event.type === 'turn/end') {
      flushReply(event.ts, true)
      turnStartTs = undefined
      currentTurn = undefined
      currentStep = undefined
      if (event.reason && event.reason !== 'complete') {
        nodes.push({ id: `turn-${event.seq}`, kind: 'turn', text: `回合结束：${event.reason}` })
      }
    }
  }
  // 仍在 open turn 内：未结束，继续 streaming；否则按历史定稿收尾
  flushReply(undefined, currentTurn == null)
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
  usage?: TrajectoryUsage
  callId?: string
}

/** token 友好缩写：<1k 原样，<1M 用 k(>10k 取整)，≥1M 用 M，例 1500→1.5k、345678→346k。 */
export function formatTokens(n: number): string {
  if (!n) return '0'
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

export function formatTrajectoryUsage(usage: TrajectoryUsage | undefined): string {
  if (!usage) return ''
  const parts = [`${formatTokens(usage.inputTokens)}→${formatTokens(usage.outputTokens)}`]
  if (usage.cacheReadTokens) parts.push(`c${formatTokens(usage.cacheReadTokens)}`)
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

/** 从轨迹行提取每个 step（assistant/message + usage）的 input/output 序列，供折线图使用。 */
export function extractUsagePoints(rows: TrajectoryRow[]): { input: number; output: number }[] {
  const out: { input: number; output: number }[] = []
  for (const row of rows) {
    if (row.type !== 'assistant/message' || !row.usage) continue
    out.push({
      input: row.usage.inputTokens || 0,
      output: row.usage.outputTokens || 0,
    })
  }
  return out
}

/** 把 Live 派工到其它 session 的 turn usage 叠到对应 Live turn 的 reply 上。 */
export function mergeDispatchedUsageIntoNodes(
  nodes: ChatNode[],
  byTurn?: Record<string, TrajectoryUsage> | null,
): ChatNode[] {
  if (!byTurn || !Object.keys(byTurn).length) return nodes
  return nodes.map((node) => {
    if (node.kind !== 'reply' || node.turn == null) return node
    const extra = byTurn[String(node.turn)]
    if (!extra) return node
    const base = node.usage
    return {
      ...node,
      usage: {
        inputTokens: (base?.inputTokens ?? 0) + extra.inputTokens,
        outputTokens: (base?.outputTokens ?? 0) + extra.outputTokens,
        totalTokens:
          (base?.totalTokens ?? (base ? base.inputTokens + base.outputTokens : 0)) +
          (extra.totalTokens ?? extra.inputTokens + extra.outputTokens),
        ...(((base?.cacheReadTokens ?? 0) + (extra.cacheReadTokens ?? 0))
          ? {
              cacheReadTokens: (base?.cacheReadTokens ?? 0) + (extra.cacheReadTokens ?? 0),
            }
          : {}),
      },
    }
  })
}

/** 本地合计 + Live 派工合计。 */
export function sumUsageParts(
  local: TrajectoryUsage | undefined,
  dispatched: TrajectoryUsage | undefined,
): TrajectoryUsage | undefined {
  if (!local && !dispatched) return undefined
  if (!local) return dispatched
  if (!dispatched) return local
  const cache = (local.cacheReadTokens ?? 0) + (dispatched.cacheReadTokens ?? 0)
  return {
    inputTokens: local.inputTokens + dispatched.inputTokens,
    outputTokens: local.outputTokens + dispatched.outputTokens,
    totalTokens:
      (local.totalTokens ?? local.inputTokens + local.outputTokens) +
      (dispatched.totalTokens ?? dispatched.inputTokens + dispatched.outputTokens),
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
