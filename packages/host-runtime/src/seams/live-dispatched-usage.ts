import type { SessionEvent } from '../core/session-types.ts'

export type TokenUsageSum = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens?: number
}

export type DispatchedTaskStatus = 'pending' | 'running' | 'complete' | 'ended'

export type DispatchedTask = {
  sessionId: string
  tool: 'session_wake' | 'session_inject'
  liveTurn: number
  wakeTs: number
  status: DispatchedTaskStatus
  reason?: string
  workerTurn?: number
  usage?: TokenUsageSum
  /** wake/inject 文本摘要 */
  preview?: string
}

export type LiveTurnDispatch = {
  tasks: DispatchedTask[]
  usage: TokenUsageSum
}

function emptyUsage(): TokenUsageSum {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
}

function addUsage(
  target: TokenUsageSum,
  usage: { inputTokens: number; outputTokens: number; totalTokens?: number; cacheReadTokens?: number },
) {
  target.inputTokens += usage.inputTokens
  target.outputTokens += usage.outputTokens
  target.totalTokens += usage.totalTokens ?? usage.inputTokens + usage.outputTokens
  if (usage.cacheReadTokens) {
    target.cacheReadTokens = (target.cacheReadTokens ?? 0) + usage.cacheReadTokens
  }
}

function usageOrUndefined(usage: TokenUsageSum): TokenUsageSum | undefined {
  if (usage.inputTokens === 0 && usage.outputTokens === 0 && !usage.cacheReadTokens) return undefined
  return { ...usage }
}

function parseWakeArgs(argumentsJson: string): { sessionId: string; preview?: string } {
  try {
    const args = JSON.parse(argumentsJson || '{}') as { sessionId?: unknown; text?: unknown }
    const sessionId = String(args.sessionId || '').trim()
    const text = String(args.text || '').trim().replace(/\s+/g, ' ')
    return {
      sessionId,
      // 派工表主文案：来自当次 wake/inject，不是 worker session 标题
      ...(text ? { preview: text.slice(0, 240) } : {}),
    }
  } catch {
    return { sessionId: '' }
  }
}

type LiveWake = {
  ts: number
  targetId: string
  liveTurn: number
  tool: 'session_wake' | 'session_inject'
  preview?: string
}

/** 从 Live 日志收集 session_wake / session_inject 派工点。 */
export function listLiveWakes(liveEvents: SessionEvent[]): LiveWake[] {
  const wakes: LiveWake[] = []
  let liveTurn: number | null = null
  for (const event of liveEvents) {
    if (event.type === 'turn/start') {
      liveTurn = event.turn
      continue
    }
    if (event.type === 'turn/end') {
      liveTurn = null
      continue
    }
    if (event.type !== 'tool/call') continue
    if (event.name !== 'session_wake' && event.name !== 'session_inject') continue
    if (liveTurn == null) continue
    const parsed = parseWakeArgs(event.arguments)
    if (!parsed.sessionId) continue
    wakes.push({
      ts: event.ts,
      targetId: parsed.sessionId,
      liveTurn,
      tool: event.name,
      ...(parsed.preview ? { preview: parsed.preview } : {}),
    })
  }
  return wakes
}

type WorkerTurnHit = {
  userTs: number
  workerTurn: number | null
  status: DispatchedTaskStatus
  reason?: string
  usage: TokenUsageSum
}

/** 在 worker 日志里找出由 liveId 发起、且尚未匹配的 turn（按 user/message 时间）。 */
function findWorkerTurnsForLive(
  liveId: string,
  events: SessionEvent[],
): WorkerTurnHit[] {
  const hits: WorkerTurnHit[] = []
  let turn: number | null = null
  let attributed = false
  let userTs = 0
  let turnUsage = emptyUsage()
  let reason: string | undefined
  let ended = false

  const flush = () => {
    if (!attributed) {
      turn = null
      attributed = false
      userTs = 0
      turnUsage = emptyUsage()
      reason = undefined
      ended = false
      return
    }
    const status: DispatchedTaskStatus = !ended
      ? 'running'
      : reason === 'complete' || reason === 'completed'
        ? 'complete'
        : 'ended'
    hits.push({
      userTs,
      workerTurn: turn,
      status,
      ...(reason ? { reason } : {}),
      usage: { ...turnUsage },
    })
    turn = null
    attributed = false
    userTs = 0
    turnUsage = emptyUsage()
    reason = undefined
    ended = false
  }

  for (const event of events) {
    if (event.type === 'turn/start') {
      flush()
      turn = event.turn
      continue
    }
    if (event.type === 'user/message') {
      if (event.sender?.type === 'session' && event.sender.sessionId === liveId) {
        attributed = true
        userTs = event.ts
      }
      continue
    }
    if (event.type === 'assistant/message' && event.usage && attributed) {
      addUsage(turnUsage, event.usage)
      continue
    }
    if (event.type === 'turn/end') {
      if (attributed) {
        ended = true
        reason = event.reason
      }
      flush()
    }
  }
  flush()
  return hits
}

/**
 * Live 派工子任务（衍生）：每个 wake/inject 一条，带运行状态与 usage。
 * 不写回 session 日志。
 */
export function collectLiveDispatchedTasks(
  liveId: string,
  liveEvents: SessionEvent[],
  workers: Array<{ id: string; events: SessionEvent[] }>,
): {
  tasks: DispatchedTask[]
  byLiveTurn: Record<string, LiveTurnDispatch>
  total: TokenUsageSum
} {
  const wakes = listLiveWakes(liveEvents)
  const workerHits = new Map<string, WorkerTurnHit[]>()
  for (const worker of workers) {
    if (worker.id === liveId) continue
    workerHits.set(worker.id, findWorkerTurnsForLive(liveId, worker.events))
  }
  const usedHit = new Map<string, Set<number>>()

  const tasks: DispatchedTask[] = wakes.map((wake) => {
    const hits = workerHits.get(wake.targetId) ?? []
    const used = usedHit.get(wake.targetId) ?? new Set<number>()
    usedHit.set(wake.targetId, used)

    let best = -1
    for (let i = 0; i < hits.length; i += 1) {
      if (used.has(i)) continue
      const hit = hits[i]!
      if (wake.ts > hit.userTs + 2000) continue
      if (best < 0 || hit.userTs <= hits[best]!.userTs) best = i
    }

    if (best < 0) {
      return {
        sessionId: wake.targetId,
        tool: wake.tool,
        liveTurn: wake.liveTurn,
        wakeTs: wake.ts,
        status: 'pending' as const,
        ...(wake.preview ? { preview: wake.preview } : {}),
      }
    }

    used.add(best)
    const hit = hits[best]!
    return {
      sessionId: wake.targetId,
      tool: wake.tool,
      liveTurn: wake.liveTurn,
      wakeTs: wake.ts,
      status: hit.status,
      ...(hit.reason ? { reason: hit.reason } : {}),
      ...(hit.workerTurn != null ? { workerTurn: hit.workerTurn } : {}),
      ...(usageOrUndefined(hit.usage) ? { usage: usageOrUndefined(hit.usage) } : {}),
      ...(wake.preview ? { preview: wake.preview } : {}),
    }
  })

  const byLiveTurn: Record<string, LiveTurnDispatch> = {}
  const total = emptyUsage()
  for (const task of tasks) {
    const key = String(task.liveTurn)
    const bucket = byLiveTurn[key] ?? { tasks: [], usage: emptyUsage() }
    bucket.tasks.push(task)
    if (task.usage) addUsage(bucket.usage, task.usage)
    byLiveTurn[key] = bucket
    if (task.usage) addUsage(total, task.usage)
  }

  return { tasks, byLiveTurn, total }
}

/** 兼容旧调用：只取 usage 合计。 */
export function collectLiveDispatchedUsage(
  liveId: string,
  liveEvents: SessionEvent[],
  workers: Array<{ id: string; events: SessionEvent[] }>,
): { byLiveTurn: Record<string, TokenUsageSum>; total: TokenUsageSum } {
  const collected = collectLiveDispatchedTasks(liveId, liveEvents, workers)
  const byLiveTurn: Record<string, TokenUsageSum> = {}
  for (const [key, value] of Object.entries(collected.byLiveTurn)) {
    byLiveTurn[key] = value.usage
  }
  return { byLiveTurn, total: collected.total }
}
