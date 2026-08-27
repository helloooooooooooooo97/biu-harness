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

/**
 * Input 胶囊：中性底板 + 数字。历史占比在左、cache hit 在右，不再叠色、不再画条。
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
      <span className="traj-usage-in-wrap" title={title}>
        {hist != null ? <span className="traj-usage-hist-pct">{hist}%</span> : null}
        <span className="traj-usage-in">{formatTok(usage.inputTokens)}</span>
        {pct != null ? <span className="traj-usage-cache-pct">{pct}%</span> : null}
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
