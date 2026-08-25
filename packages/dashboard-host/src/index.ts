import type { Context } from 'cordis'

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

type HostCtx = Context & {
  http: {
    route: (
      method: string,
      pattern: string,
      handler: (route: { send: (status: number, body: unknown) => void }) => void | Promise<void>,
    ) => unknown
  }
  hub: {
    register: (page: {
      id: string
      title: string
      subtitle: string
      plugin: string
      kind: string
    }) => unknown
  }
  sessions: {
    listSummaries: () => Promise<
      Array<{ id: string; eventCount: number; updatedAt: number; project?: { name: string; path?: string } }>
    >
    get: (id: string) => Promise<{ events: Array<Record<string, unknown>> } | undefined>
  }
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
  const host = ctx as HostCtx
  host.hub.register({
    id: 'dashboard',
    title: '控制台',
    subtitle: '用量与项目概览',
    plugin: 'dashboard',
    kind: 'dashboard',
  })

  host.http.route('GET', '/api/stats/overview', async (route) => {
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

    const summaries = await host.sessions.listSummaries()
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

      const record = await host.sessions.get(summary.id)
      if (!record) continue
      for (const event of record.events) {
        const type = String(event.type || '')
        const ts = Number(event.ts || 0)
        if (type === 'turn/start') {
          if (dayKey(ts) === todayKey) today.turns += 1
          if (ts >= hourStart) {
            const key = hourKey(ts)
            const bucket =
              hourlyMap.get(key) ??
              ({ key, label: hourLabel(key), inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, turns: 0 } satisfies UsageBucket)
            bucket.turns += 1
            hourlyMap.set(key, bucket)
          }
          if (ts >= dayStart) {
            const key = dayKey(ts)
            const bucket =
              dailyMap.get(key) ??
              ({ key, label: key, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, turns: 0 } satisfies UsageBucket)
            bucket.turns += 1
            dailyMap.set(key, bucket)
          }
        }
        if (type !== 'assistant/message' || !event.usage || typeof event.usage !== 'object') continue
        const raw = event.usage as { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number }
        const usage = {
          inputTokens: Number(raw.inputTokens || 0),
          outputTokens: Number(raw.outputTokens || 0),
          cacheReadTokens: Number(raw.cacheReadTokens || 0),
        }
        if (dayKey(ts) === todayKey) addUsage(today, usage)
        if (ts >= hourStart) {
          const key = hourKey(ts)
          const bucket =
            hourlyMap.get(key) ??
            ({ key, label: hourLabel(key), inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, turns: 0 } satisfies UsageBucket)
          addUsage(bucket, usage)
          hourlyMap.set(key, bucket)
        }
        if (ts >= dayStart) {
          const key = dayKey(ts)
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
