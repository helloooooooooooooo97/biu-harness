import type { SessionEvent } from '../core/session-types.ts'

export type TokenUsageSum = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens?: number
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

function parseWakeTarget(argumentsJson: string): string {
  try {
    const args = JSON.parse(argumentsJson || '{}') as { sessionId?: unknown }
    return String(args.sessionId || '').trim()
  } catch {
    return ''
  }
}

type LiveWake = { ts: number; targetId: string; liveTurn: number }

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
    const targetId = parseWakeTarget(event.arguments)
    if (!targetId) continue
    wakes.push({ ts: event.ts, targetId, liveTurn })
  }
  return wakes
}

/**
 * 把其它 session 里「由该 Live wake/inject 发起」的 turn usage
 * 归到 Live 当时的 turn（及合计）。
 */
export function collectLiveDispatchedUsage(
  liveId: string,
  liveEvents: SessionEvent[],
  workers: Array<{ id: string; events: SessionEvent[] }>,
): { byLiveTurn: Record<string, TokenUsageSum>; total: TokenUsageSum } {
  const wakes = listLiveWakes(liveEvents)
  const used = new Set<number>()
  const byLiveTurn: Record<string, TokenUsageSum> = {}
  const total = emptyUsage()

  const attribute = (workerId: string, userTs: number, turnUsage: TokenUsageSum) => {
    if (turnUsage.inputTokens === 0 && turnUsage.outputTokens === 0 && !turnUsage.cacheReadTokens) {
      return
    }
    let best = -1
    for (let i = 0; i < wakes.length; i += 1) {
      if (used.has(i)) continue
      const wake = wakes[i]!
      if (wake.targetId !== workerId) continue
      // 派工应不晚于 worker 收到 user/message（允许少量时钟误差）
      if (wake.ts > userTs + 2000) continue
      if (best < 0 || wake.ts >= wakes[best]!.ts) best = i
    }
    addUsage(total, turnUsage)
    if (best < 0) return
    used.add(best)
    const key = String(wakes[best]!.liveTurn)
    const bucket = byLiveTurn[key] ?? emptyUsage()
    addUsage(bucket, turnUsage)
    byLiveTurn[key] = bucket
  }

  for (const worker of workers) {
    if (worker.id === liveId) continue
    let attributed = false
    let userTs = 0
    let turnUsage = emptyUsage()
    let hasUsage = false

    const flush = () => {
      if (attributed && hasUsage) attribute(worker.id, userTs, turnUsage)
      attributed = false
      userTs = 0
      turnUsage = emptyUsage()
      hasUsage = false
    }

    for (const event of worker.events) {
      if (event.type === 'turn/start') {
        flush()
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
        hasUsage = true
        continue
      }
      if (event.type === 'turn/end') {
        flush()
      }
    }
    flush()
  }

  return { byLiveTurn, total }
}
