import { useEffect, useState } from 'react'

type UsageTotals = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  turns: number
}

type UsageBucket = UsageTotals & {
  key: string
  label: string
}

type ProjectStat = {
  name: string
  path?: string
  sessions: number
  events: number
}

type StatsOverview = {
  generatedAt: number
  totals: { sessions: number; events: number; scannedSessions: number }
  today: UsageTotals
  hourly: UsageBucket[]
  daily: UsageBucket[]
  projects: ProjectStat[]
}

function formatTok(n: number) {
  return n.toLocaleString('en-US')
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0
  return (
    <div className="dash-bar-row">
      <span className="dash-bar-label">{label}</span>
      <div className="dash-bar-track">
        <div className="dash-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="dash-bar-value">{formatTok(value)}</span>
    </div>
  )
}

export function DashboardModule() {
  const [data, setData] = useState<StatsOverview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetch('/api/stats/overview')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as StatsOverview
      })
      .then((next) => {
        if (cancelled) return
        setData(next)
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        setError(String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hourlyMax = Math.max(1, ...(data?.hourly.map((item) => item.inputTokens + item.outputTokens) ?? [1]))
  const dailyMax = Math.max(1, ...(data?.daily.map((item) => item.inputTokens + item.outputTokens) ?? [1]))

  return (
    <div className="dash-root">
      <header className="dash-header">
        <div>
          <h1 className="dash-title">Dashboard</h1>
          <p className="dash-subtitle">控制台 · 用量与今日项目概览</p>
        </div>
        {data ? (
          <span className="dash-updated">扫描 {data.totals.scannedSessions}/{data.totals.sessions} 会话</span>
        ) : null}
      </header>

      {loading ? <p className="dash-muted">加载统计中…</p> : null}
      {error ? <p className="dash-error">{error}</p> : null}

      {data ? (
        <>
          <section className="dash-cards" aria-label="今日概览">
            <article className="dash-card">
              <div className="dash-card-label">今日回合</div>
              <div className="dash-card-value">{formatTok(data.today.turns)}</div>
            </article>
            <article className="dash-card">
              <div className="dash-card-label">今日 Input</div>
              <div className="dash-card-value">{formatTok(data.today.inputTokens)}</div>
            </article>
            <article className="dash-card">
              <div className="dash-card-label">今日 Output</div>
              <div className="dash-card-value">{formatTok(data.today.outputTokens)}</div>
            </article>
            <article className="dash-card">
              <div className="dash-card-label">今日 Cache</div>
              <div className="dash-card-value">{formatTok(data.today.cacheReadTokens)}</div>
            </article>
          </section>

          <div className="dash-grid">
            <section className="dash-panel">
              <h2 className="dash-panel-title">近 24 小时用量</h2>
              <div className="dash-bars">
                {data.hourly.length === 0 ? (
                  <p className="dash-muted">暂无小时数据</p>
                ) : (
                  data.hourly.map((item) => (
                    <BarRow
                      key={item.key}
                      label={item.label}
                      value={item.inputTokens + item.outputTokens}
                      max={hourlyMax}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="dash-panel">
              <h2 className="dash-panel-title">近 7 天用量</h2>
              <div className="dash-bars">
                {data.daily.length === 0 ? (
                  <p className="dash-muted">暂无日数据</p>
                ) : (
                  data.daily.map((item) => (
                    <BarRow
                      key={item.key}
                      label={item.label.slice(5)}
                      value={item.inputTokens + item.outputTokens}
                      max={dailyMax}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="dash-panel dash-panel-wide">
              <h2 className="dash-panel-title">今日项目情况</h2>
              {data.projects.length === 0 ? (
                <p className="dash-muted">还没有绑定项目的会话</p>
              ) : (
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>项目</th>
                      <th>会话</th>
                      <th>事件</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.projects.map((item) => (
                      <tr key={item.path || item.name}>
                        <td>
                          <div className="dash-project-name">{item.name}</div>
                          {item.path ? <div className="dash-project-path">{item.path}</div> : null}
                        </td>
                        <td>{item.sessions}</td>
                        <td>{item.events}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  )
}
