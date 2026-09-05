import type { SessionEvent } from '@biu/type-session'

export type TokenUsageSum = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens?: number
}

export type DispatchedTaskStatus = 'pending' | 'running' | 'complete' | 'ended'

export type DispatchedTask = {
  sessionId: string
  tool: 'task_deliver'
  liveTurn: number
  wakeTs: number
  status: DispatchedTaskStatus
  reason?: string
  workerTurn?: number
  usage?: TokenUsageSum
  /** 派工任务标题/文本摘要 */
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

/** Live 本回合派工对应的任务最小视图（由 core-chat 从 task 体系取数传入）。 */
export type TaskDispatchSource = {
  /** 任务 id */
  id: string
  /** 任务标题（派工表主文案） */
  title: string
  /** 执行 agent 的 sessionId（assignee.kind==='agent'） */
  sessionId: string
  /** 任务创建时间戳（= 派工点） */
  createdAt: number
  /** 任务状态：todo→pending / doing→running / done→complete */
  status: 'todo' | 'doing' | 'done'
}

type LiveDispatchPoint = {
  ts: number
  targetId: string
  liveTurn: number
  preview?: string
  status: DispatchedTaskStatus
}

/** 把本 live 派发的任务（task_deliver）映射为派工点，并按 createdAt 定位到 Live 日志里的 turn。 */
export function buildLiveDispatchPoints(
  liveEvents: SessionEvent[],
  tasks: TaskDispatchSource[],
): LiveDispatchPoint[] {
  if (!tasks.length) return []
  // 建 turn 时间区间（turn/start .. turn/end）
  const turns: Array<{ turn: number; start: number; end: number }> = []
  let current: { turn: number; start: number; end: number } | null = null
  for (const event of liveEvents) {
    if (event.type === 'turn/start') {
      current = { turn: event.turn, start: event.ts, end: event.ts }
      continue
    }
    if (event.type === 'turn/end') {
      if (current) current.end = event.ts
      if (current) turns.push(current)
      current = null
      continue
    }
  }
  const findTurn = (ts: number): number | null => {
    // 精确区间内优先；否则取相邻最近 turn
    let best: { turn: number; dist: number } | null = null
    for (const t of turns) {
      if (ts >= t.start && ts <= t.end) return t.turn
      const dist = ts < t.start ? t.start - ts : ts - t.end
      if (best == null || dist < best.dist) best = { turn: t.turn, dist }
    }
    return best?.turn ?? null
  }
  return tasks
    .map((task) => {
      const liveTurn = findTurn(task.createdAt) ?? 0
      const status: DispatchedTaskStatus =
        task.status === 'done' ? 'complete' : task.status === 'doing' ? 'running' : 'pending'
      return {
        ts: task.createdAt,
        targetId: task.sessionId,
        liveTurn,
        preview: task.title,
        status,
      }
    })
    .filter((point) => point.targetId)
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
 * Live 派工子任务（衍生）：每个 task_deliver 派工一条，带运行状态与 usage。
 * 数据来源为 task 体系（tasks 参数：本 live 作为 creator 派发的任务），不扫 wake/inject。
 * 不写回 session 日志。
 */
export function collectLiveDispatchedTasks(
  liveId: string,
  liveEvents: SessionEvent[],
  workers: Array<{ id: string; events: SessionEvent[] }>,
  tasks: TaskDispatchSource[] = [],
): {
  tasks: DispatchedTask[]
  byLiveTurn: Record<string, LiveTurnDispatch>
  total: TokenUsageSum
} {
  const wakes = buildLiveDispatchPoints(liveEvents, tasks)
  const workerHits = new Map<string, WorkerTurnHit[]>()
  for (const worker of workers) {
    if (worker.id === liveId) continue
    workerHits.set(worker.id, findWorkerTurnsForLive(liveId, worker.events))
  }
  const usedHit = new Map<string, Set<number>>()

  const dispatched: DispatchedTask[] = wakes.map((wake) => {
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
        tool: 'task_deliver' as const,
        liveTurn: wake.liveTurn,
        wakeTs: wake.ts,
        status: wake.status,
        ...(wake.preview ? { preview: wake.preview } : {}),
      }
    }

    used.add(best)
    const hit = hits[best]!
    return {
      sessionId: wake.targetId,
      tool: 'task_deliver' as const,
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
  for (const task of dispatched) {
    const key = String(task.liveTurn)
    const bucket = byLiveTurn[key] ?? { tasks: [], usage: emptyUsage() }
    bucket.tasks.push(task)
    if (task.usage) addUsage(bucket.usage, task.usage)
    byLiveTurn[key] = bucket
    if (task.usage) addUsage(total, task.usage)
  }

  return { tasks: dispatched, byLiveTurn, total }
}

/** 兼容旧调用：只取 usage 合计。 */
export function collectLiveDispatchedUsage(
  liveId: string,
  liveEvents: SessionEvent[],
  workers: Array<{ id: string; events: SessionEvent[] }>,
  tasks: TaskDispatchSource[] = [],
): { byLiveTurn: Record<string, TokenUsageSum>; total: TokenUsageSum } {
  const collected = collectLiveDispatchedTasks(liveId, liveEvents, workers, tasks)
  const byLiveTurn: Record<string, TokenUsageSum> = {}
  for (const [key, value] of Object.entries(collected.byLiveTurn)) {
    byLiveTurn[key] = value.usage
  }
  return { byLiveTurn, total: collected.total }
}
