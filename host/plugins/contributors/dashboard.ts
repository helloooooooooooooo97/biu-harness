import type { Context } from 'cordis'
import '../../types.ts'
import type { SessionEvent } from '../core/session-types.ts'

export const name = 'dashboard'
export const inject = ['http', 'hub', 'sessions']

type UsageBucket = {
  key: string
  label: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  turns: number
}

type ProjectStat = {
  name: string
  path?: string
  sessions: number
  events: number
}

function emptyUsage() {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, turns: 0 }
}

function addUsage(
  target: { inputTokens: number; outputTokens: number; cacheReadTokens: number; turns?: number },
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number },
) {
  target.inputTokens += usage.inputTokens
  target.outputTokens += usage.outputTokens
  target.cacheReadTokens += usage.cacheReadTokens ?? 0
}

function hourKey(ts: number) {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}`
}

function dayKey(ts: number) {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function hourLabel(key: string) {
  const hour = key.slice(11, 13)
  return `${hour}:00`
}

export function apply(ctx: Context) {
  ctx.http.route('GET', '/api/snapshot', (route) => {
    route.send(200, ctx.hub.snapshot())
  })
  ctx.http.route('POST', '/api/plugins/:id', async (route) => {
    const payload = (await route.json()) as { enabled?: boolean }
    try {
      route.send(200, await ctx.hub.setEnabled(route.params.id, Boolean(payload.enabled)))
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })

  ctx.http.route('GET', '/api/stats/overview', async (route) => {
    const now = Date.now()
    const todayKey = dayKey(now)
    const hourStart = now - 24 * 60 * 60 * 1000
    const dayStart = now - 7 * 24 * 60 * 60 * 1000

    const today = emptyUsage()
    const hourlyMap = new Map<string, UsageBucket>()
    const dailyMap = new Map<string, UsageBucket>()
    const projects = new Map<string, ProjectStat>()
    let sessionCount = 0
    let eventCount = 0

    const summaries = await ctx.sessions.listSummaries()
    // 最近会话优先，避免全量扫爆
    const recent = [...summaries].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 80)
    sessionCount = summaries.length

    for (const summary of recent) {
      eventCount += summary.eventCount
      if (summary.project?.name) {
        const key = summary.project.path || summary.project.name
        const prev = projects.get(key) ?? {
          name: summary.project.name,
          ...(summary.project.path ? { path: summary.project.path } : {}),
          sessions: 0,
          events: 0,
        }
        prev.sessions += 1
        prev.events += summary.eventCount
        projects.set(key, prev)
      }

      const record = await ctx.sessions.get(summary.id)
      if (!record) continue
      for (const event of record.events as SessionEvent[]) {
        if (event.type === 'turn/start') {
          if (dayKey(event.ts) === todayKey) today.turns += 1
          if (event.ts >= hourStart) {
            const key = hourKey(event.ts)
            const bucket =
              hourlyMap.get(key) ??
              ({ key, label: hourLabel(key), inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, turns: 0 } satisfies UsageBucket)
            bucket.turns += 1
            hourlyMap.set(key, bucket)
          }
          if (event.ts >= dayStart) {
            const key = dayKey(event.ts)
            const bucket =
              dailyMap.get(key) ??
              ({ key, label: key, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, turns: 0 } satisfies UsageBucket)
            bucket.turns += 1
            dailyMap.set(key, bucket)
          }
        }
        if (event.type !== 'assistant/message' || !event.usage) continue
        const usage = {
          inputTokens: event.usage.inputTokens,
          outputTokens: event.usage.outputTokens,
          cacheReadTokens: event.usage.cacheReadTokens,
        }
        if (dayKey(event.ts) === todayKey) addUsage(today, usage)
        if (event.ts >= hourStart) {
          const key = hourKey(event.ts)
          const bucket =
            hourlyMap.get(key) ??
            ({ key, label: hourLabel(key), inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, turns: 0 } satisfies UsageBucket)
          addUsage(bucket, usage)
          hourlyMap.set(key, bucket)
        }
        if (event.ts >= dayStart) {
          const key = dayKey(event.ts)
          const bucket =
            dailyMap.get(key) ??
            ({ key, label: key, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, turns: 0 } satisfies UsageBucket)
          addUsage(bucket, usage)
          dailyMap.set(key, bucket)
        }
      }
    }

    const hourly = [...hourlyMap.values()].sort((a, b) => a.key.localeCompare(b.key))
    const daily = [...dailyMap.values()].sort((a, b) => a.key.localeCompare(b.key))
    const projectStats = [...projects.values()].sort((a, b) => b.events - a.events).slice(0, 12)

    route.send(200, {
      generatedAt: now,
      totals: {
        sessions: sessionCount,
        events: eventCount,
        scannedSessions: recent.length,
      },
      today,
      hourly,
      daily,
      projects: projectStats,
    })
  })
}
