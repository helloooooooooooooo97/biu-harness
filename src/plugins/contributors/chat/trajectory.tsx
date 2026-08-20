import { useEffect, useMemo, useState } from 'react'
import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'
import {
  formatTrajectoryUsage,
  sumTrajectoryUsage,
  type SessionEvent,
  type TrajectoryRow,
  type TrajectoryUsage,
} from '../../infrastructure/session-project.ts'

type TagTone = 'user' | 'assistant' | 'tool' | 'system' | 'turn' | 'step'

function toneOf(type: TrajectoryRow['type']): TagTone {
  if (type.startsWith('user/')) return 'user'
  if (type.startsWith('assistant/')) return 'assistant'
  if (type.startsWith('tool/')) return 'tool'
  if (type.startsWith('system/')) return 'system'
  if (type.startsWith('turn/')) return 'turn'
  if (type.startsWith('step/')) return 'step'
  return 'system'
}

const toneClass: Record<TagTone, string> = {
  user: 'traj-tag traj-tag-user',
  assistant: 'traj-tag traj-tag-assistant',
  tool: 'traj-tag traj-tag-tool',
  system: 'traj-tag traj-tag-system',
  turn: 'traj-tag traj-tag-turn',
  step: 'traj-tag traj-tag-step',
}

function formatTok(n: number) {
  return n.toLocaleString('en-US')
}

function UsageInline({ usage, empty = '—' }: { usage?: TrajectoryUsage; empty?: string }) {
  if (!usage) return <span className="traj-usage-empty">{empty}</span>
  return (
    <span className="traj-usage" title={formatTrajectoryUsage(usage)}>
      <span className="traj-usage-in" title="input tokens">
        {formatTok(usage.inputTokens)}
      </span>
      <span className="traj-usage-arrow" aria-hidden>
        →
      </span>
      <span className="traj-usage-out" title="output tokens">
        {formatTok(usage.outputTokens)}
      </span>
      {usage.cacheReadTokens ? (
        <span className="traj-usage-cache" title="cache read tokens">
          c{formatTok(usage.cacheReadTokens)}
        </span>
      ) : null}
    </span>
  )
}

function UsageCard({ usage, label = 'Token usage' }: { usage: TrajectoryUsage; label?: string }) {
  const total = usage.totalTokens ?? usage.inputTokens + usage.outputTokens
  const cacheRatio =
    usage.inputTokens > 0 && usage.cacheReadTokens
      ? Math.min(100, Math.round((usage.cacheReadTokens / usage.inputTokens) * 100))
      : null
  return (
    <section className="traj-usage-card" aria-label={label}>
      <div className="traj-usage-card-title">{label}</div>
      <div className="traj-usage-grid">
        <div className="traj-usage-stat traj-usage-stat-in">
          <span>Input</span>
          <strong>{formatTok(usage.inputTokens)}</strong>
        </div>
        <div className="traj-usage-stat traj-usage-stat-out">
          <span>Output</span>
          <strong>{formatTok(usage.outputTokens)}</strong>
        </div>
        <div className="traj-usage-stat">
          <span>Total</span>
          <strong>{formatTok(total)}</strong>
        </div>
        {usage.cacheReadTokens != null && usage.cacheReadTokens > 0 ? (
          <div className="traj-usage-stat traj-usage-stat-cache">
            <span>Cache read{cacheRatio != null ? ` · ${cacheRatio}%` : ''}</span>
            <strong>{formatTok(usage.cacheReadTokens)}</strong>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function TrajectoryView(props: SlotProps) {
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const rows = useSessionView((state) => state.trajectory)
  const events = useSessionView((state) => state.events)
  const focusCallId = useSessionView((state) => state.focusCallId)
  const sessionId = useSessionView((state) => state.sessionId)
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null)

  const groups = useMemo(() => groupByTurn(rows), [rows])
  const cumulative = useMemo(() => sumTrajectoryUsage(events), [events])
  const selected = useMemo(
    () => (selectedSeq == null ? undefined : events.find((event) => event.seq === selectedSeq)),
    [events, selectedSeq],
  )

  useEffect(() => {
    if (!focusCallId) return
    const row = rows.find((item) => item.callId === focusCallId)
    if (row) setSelectedSeq(row.seq)
    document.getElementById(`traj-call-${focusCallId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusCallId, rows])

  useEffect(() => {
    if (selectedSeq == null) return
    if (!events.some((event) => event.seq === selectedSeq)) setSelectedSeq(null)
  }, [events, selectedSeq])

  if (!sessionId) {
    return (
      <div className="traj-empty">
        <p className="traj-empty-title">No session</p>
        <p className="traj-empty-body">Open or create a session to inspect its append-only event ledger.</p>
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="traj-empty">
        <p className="traj-empty-title">Empty trajectory</p>
        <p className="traj-empty-body">Send a message in Chat — events will project here as they append.</p>
      </div>
    )
  }

  return (
    <div className={`traj-root${selected ? ' traj-root-split' : ''}`}>
      <div className="traj-pane">
        <div className="traj-meta">
          <span>{rows.length} events</span>
          <span className="traj-meta-sep">·</span>
          <span>{groups.length} turns</span>
          <span className="traj-meta-sep">·</span>
          <span className="traj-meta-usage" title="Sum of assistant/message usage in this session">
            <span className="traj-meta-usage-label">usage</span>
            <UsageInline usage={cumulative} />
          </span>
        </div>

        <div className="traj-head" role="row">
          <span className="traj-col-seq">#</span>
          <span className="traj-col-type">type</span>
          <span className="traj-col-summary">summary</span>
          <span className="traj-col-usage">usage</span>
        </div>

        <div className="traj-list" role="rowgroup">
          {groups.map((group) => (
            <div key={group.key} className="traj-group">
              <div className="traj-group-bar">
                <span>{group.turn == null ? 'meta' : `Turn ${group.turn}`}</span>
                <span>{group.rows.length}</span>
              </div>
              {group.rows.map((row) => {
                const focused = Boolean(focusCallId && row.callId === focusCallId) || selectedSeq === row.seq
                const tone = toneOf(row.type)
                return (
                  <button
                    key={row.id}
                    type="button"
                    id={row.callId ? `traj-call-${row.callId}` : undefined}
                    role="row"
                    className={`traj-row traj-depth-${row.depth}${focused ? ' traj-row-focus' : ''}${
                      row.type === 'assistant/message' ? ' traj-row-assistant' : ''
                    }`}
                    onClick={() => setSelectedSeq(row.seq)}
                  >
                    <span className="traj-col-seq">{row.seq}</span>
                    <span className="traj-col-type">
                      <span className={toneClass[tone]} title={row.type}>
                        {row.type}
                      </span>
                    </span>
                    <span className="traj-col-summary" title={row.summary}>
                      {row.summary}
                    </span>
                    <span className="traj-col-usage">
                      <UsageInline usage={row.usage} />
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {selected ? (
        <aside className="traj-detail" aria-label="Event detail">
          <div className="traj-detail-head">
            <div>
              <div className="traj-detail-title">#{selected.seq}</div>
              <div className="traj-detail-type">{selected.type}</div>
            </div>
            <button type="button" className="traj-detail-close" onClick={() => setSelectedSeq(null)}>
              Close
            </button>
          </div>
          <EventDetailBody event={selected} />
        </aside>
      ) : null}
    </div>
  )
}

function EventDetailBody({ event }: { event: SessionEvent }) {
  const fields = detailFields(event)
  const usage = event.type === 'assistant/message' ? event.usage : undefined
  return (
    <div className="traj-detail-body">
      <dl className="traj-detail-meta">
        <div>
          <dt>seq</dt>
          <dd>{event.seq}</dd>
        </div>
        <div>
          <dt>ts</dt>
          <dd>{new Date(event.ts).toISOString()}</dd>
        </div>
        {fields.map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
      {usage ? <UsageCard usage={usage} /> : null}
      <pre className="traj-detail-json">{JSON.stringify(omitUsage(event), null, 2)}</pre>
    </div>
  )
}

function omitUsage(event: SessionEvent): SessionEvent | Record<string, unknown> {
  if (event.type !== 'assistant/message' || !event.usage) return event
  const { usage: _usage, ...rest } = event
  return rest
}

function detailFields(event: SessionEvent): Array<{ label: string; value: string }> {
  if (event.type === 'user/message' || event.type === 'assistant/chunk' || event.type === 'system/prompt') {
    return [
      ...(event.type === 'user/message' && event.kind ? [{ label: 'kind', value: event.kind }] : []),
      { label: 'text', value: `${event.text.length} chars` },
    ]
  }
  if (event.type === 'assistant/message') {
    const rows = [{ label: 'text', value: `${event.text.length} chars` }]
    if (event.tool_calls?.length) rows.push({ label: 'tool_calls', value: String(event.tool_calls.length) })
    return rows
  }
  if (event.type === 'tool/call') {
    return [
      { label: 'name', value: event.name },
      { label: 'id', value: event.id },
      { label: 'arguments', value: `${event.arguments.length} chars` },
    ]
  }
  if (event.type === 'tool/result') {
    return [
      { label: 'name', value: event.name },
      { label: 'ok', value: event.ok ? 'true' : 'false' },
      { label: 'detail', value: `${event.detail.length} chars` },
    ]
  }
  if (event.type === 'turn/start' || event.type === 'turn/end') {
    return [
      { label: 'turn', value: String(event.turn) },
      ...('reason' in event ? [{ label: 'reason', value: event.reason }] : []),
    ]
  }
  if (event.type === 'step/start' || event.type === 'step/end') {
    return [
      { label: 'turn', value: String(event.turn) },
      { label: 'step', value: String(event.step) },
    ]
  }
  return []
}

function groupByTurn(rows: TrajectoryRow[]) {
  const groups: Array<{ key: string; turn: number | null; rows: TrajectoryRow[] }> = []
  for (const row of rows) {
    const last = groups.at(-1)
    if (last && last.turn === row.turn) {
      last.rows.push(row)
      continue
    }
    groups.push({
      key: `${row.turn ?? 'meta'}-${row.seq}`,
      turn: row.turn,
      rows: [row],
    })
  }
  return groups
}

export function trajectoryProps(view: SessionViewService) {
  return { useSessionView: bindSessionView(view) }
}
