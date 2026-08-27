import {
  formatTokens,
  formatTrajectoryUsage,
  type TrajectoryUsage,
} from '@biu/web-session-view'

function formatTok(n: number) {
  return formatTokens(n)
}

function cacheHitPct(usage: TrajectoryUsage): number | null {
  if (!usage.inputTokens || !usage.cacheReadTokens) return null
  return Math.min(100, Math.round((usage.cacheReadTokens / usage.inputTokens) * 100))
}

/** 历史占比是 0~1 的有限数值才纳入。 */
function isHistPct(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
}

function Meter({ kind, pct }: { kind: 'hist' | 'cache'; pct: number }) {
  return (
    <span className={`traj-usage-meter is-${kind}`} aria-hidden>
      <i style={{ width: `${pct}%` }} />
    </span>
  )
}

/**
 * Input 胶囊：数字在上，历史占比 / cache hit 各一条独立细进度条，不再红绿叠层。
 * histPct 默认取 usage.histPct，也可用 histPct 参数覆盖。
 */
export function UsageInline({
  usage,
  empty = '—',
  histPct,
}: {
  usage?: TrajectoryUsage
  empty?: string
  /** 历史 turn 输入占比（0~1）；缺省取 usage.histPct，显式传入则覆盖。 */
  histPct?: number
}) {
  if (!usage) return <span className="traj-usage-empty">{empty}</span>
  const pct = cacheHitPct(usage)
  const hist = isHistPct(histPct !== undefined ? histPct : usage.histPct)
    ? Math.round((histPct !== undefined ? histPct : usage.histPct!) * 100)
    : null

  const title =
    hist != null
      ? `input ${formatTok(usage.inputTokens)} · cache hit ${pct ?? 0}% · 历史占比 ${hist}%`
      : pct != null
        ? `input ${formatTok(usage.inputTokens)} · cache hit ${pct}% (${formatTok(usage.cacheReadTokens!)})`
        : `input ${formatTok(usage.inputTokens)}`

  return (
    <span className="traj-usage" title={formatTrajectoryUsage(usage)}>
      <span className="traj-usage-in-col">
        <span
          className={`traj-usage-in-wrap${pct != null ? ' has-cache' : ''}${hist != null ? ' has-hist' : ''}`}
          title={title}
        >
          {hist != null ? <span className="traj-usage-hist-pct">{hist}%</span> : null}
          <span className="traj-usage-in">{formatTok(usage.inputTokens)}</span>
          {pct != null ? <span className="traj-usage-cache-pct">{pct}%</span> : null}
        </span>
        {hist != null || pct != null ? (
          <span className="traj-usage-meters">
            {hist != null ? <Meter kind="hist" pct={hist} /> : null}
            {pct != null ? <Meter kind="cache" pct={pct} /> : null}
          </span>
        ) : null}
      </span>
      <span className="traj-usage-arrow" aria-hidden>
        →
      </span>
      <span className="traj-usage-out" title="output tokens">
        {formatTok(usage.outputTokens)}
      </span>
    </span>
  )
}
