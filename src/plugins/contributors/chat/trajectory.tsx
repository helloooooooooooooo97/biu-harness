import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'
import {
  formatTrajectoryUsage,
  projectRequestMessages,
  sumTrajectoryUsage,
  type DerivedMessage,
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

function cacheHitPct(usage: TrajectoryUsage): number | null {
  if (!usage.inputTokens || !usage.cacheReadTokens) return null
  return Math.min(100, Math.round((usage.cacheReadTokens / usage.inputTokens) * 100))
}

/** Input 包成胶囊；缓存命中用进度背景铺在 Input 上。 */
function UsageInline({ usage, empty = '—' }: { usage?: TrajectoryUsage; empty?: string }) {
  if (!usage) return <span className="traj-usage-empty">{empty}</span>
  const pct = cacheHitPct(usage)
  const inStyle: CSSProperties | undefined =
    pct != null
      ? {
          backgroundImage: `linear-gradient(90deg, rgba(34, 140, 90, 0.28) 0%, rgba(34, 140, 90, 0.28) ${pct}%, rgba(15, 17, 21, 0.06) ${pct}%, rgba(15, 17, 21, 0.06) 100%)`,
        }
      : undefined
  return (
    <span className="traj-usage" title={formatTrajectoryUsage(usage)}>
      <span
        className={`traj-usage-in-wrap${pct != null ? ' has-cache' : ''}`}
        style={inStyle}
        title={
          pct != null
            ? `input ${formatTok(usage.inputTokens)} · cache hit ${pct}% (${formatTok(usage.cacheReadTokens!)})`
            : `input ${formatTok(usage.inputTokens)}`
        }
      >
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

function UsageCard({ usage, label = 'Token usage' }: { usage: TrajectoryUsage; label?: string }) {
  const total = usage.totalTokens ?? usage.inputTokens + usage.outputTokens
  const pct = cacheHitPct(usage)
  const inStyle: CSSProperties | undefined =
    pct != null
      ? {
          backgroundImage: `linear-gradient(90deg, rgba(34, 140, 90, 0.22) 0%, rgba(34, 140, 90, 0.22) ${pct}%, rgba(15, 17, 21, 0.04) ${pct}%, rgba(15, 17, 21, 0.04) 100%)`,
        }
      : undefined
  return (
    <section className="traj-usage-card" aria-label={label}>
      <div className="traj-usage-card-title">{label}</div>
      <div className="traj-usage-grid">
        <div className="traj-usage-stat traj-usage-stat-in" style={inStyle}>
          <span>Input{pct != null ? ` · cache ${pct}%` : ''}</span>
          <strong>{formatTok(usage.inputTokens)}</strong>
          {usage.cacheReadTokens ? (
            <em className="traj-usage-stat-sub">cache {formatTok(usage.cacheReadTokens)}</em>
          ) : null}
        </div>
        <div className="traj-usage-stat traj-usage-stat-out">
          <span>Output</span>
          <strong>{formatTok(usage.outputTokens)}</strong>
        </div>
        <div className="traj-usage-stat">
          <span>Total</span>
          <strong>{formatTok(total)}</strong>
        </div>
      </div>
    </section>
  )
}

function FoldCaret({ open }: { open: boolean }) {
  return (
    <span className={`traj-caret${open ? ' is-open' : ''}`} aria-hidden>
      ▸
    </span>
  )
}

export const TrajectoryView = memo(function TrajectoryView(props: SlotProps) {
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const rows = useSessionView((state) => state.trajectory)
  const events = useSessionView((state) => state.events)
  const focusCallId = useSessionView((state) => state.focusCallId)
  const sessionId = useSessionView((state) => state.sessionId)
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null)
  /** turn key → collapsed */
  const [collapsedTurns, setCollapsedTurns] = useState<Record<string, boolean>>({})
  /** `${turn}:${step}` → collapsed */
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({})

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
          {groups.map((group) => {
            const turnKey = group.key
            const turnCollapsed = Boolean(collapsedTurns[turnKey])
            const visibleRows = turnCollapsed
              ? []
              : filterCollapsedSteps(group.rows, group.turn, collapsedSteps)
            return (
              <div key={group.key} className={`traj-group${turnCollapsed ? ' is-collapsed' : ''}`}>
                <button
                  type="button"
                  className="traj-group-bar"
                  aria-expanded={!turnCollapsed}
                  onClick={() =>
                    setCollapsedTurns((prev) => ({ ...prev, [turnKey]: !prev[turnKey] }))
                  }
                >
                  <span className="traj-group-bar-left">
                    <FoldCaret open={!turnCollapsed} />
                    <span>{group.turn == null ? 'meta' : `Turn ${group.turn}`}</span>
                  </span>
                  <span>{group.rows.length}</span>
                </button>
                {visibleRows.map((row) => {
                  const focused = Boolean(focusCallId && row.callId === focusCallId) || selectedSeq === row.seq
                  const tone = toneOf(row.type)
                  const isStepStart = row.type === 'step/start'
                  const stepKey =
                    isStepStart && row.turn != null && row.step != null ? `${row.turn}:${row.step}` : null
                  const stepCollapsed = stepKey ? Boolean(collapsedSteps[stepKey]) : false
                  return (
                    <div key={row.id} className="traj-row-wrap">
                      {isStepStart && stepKey ? (
                        <button
                          type="button"
                          className="traj-step-fold"
                          aria-expanded={!stepCollapsed}
                          aria-label={stepCollapsed ? 'Expand step' : 'Collapse step'}
                          onClick={(event) => {
                            event.stopPropagation()
                            setCollapsedSteps((prev) => ({ ...prev, [stepKey]: !prev[stepKey] }))
                          }}
                        >
                          <FoldCaret open={!stepCollapsed} />
                        </button>
                      ) : (
                        <span className="traj-step-fold-spacer" aria-hidden />
                      )}
                      <button
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
                    </div>
                  )
                })}
              </div>
            )
          })}
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
          <EventDetailBody event={selected} events={events} />
        </aside>
      ) : null}
    </div>
  )
})

/** 折叠的 step：隐藏 step/start 之后到对应 step/end（含）之间的行，start 行本身保留。 */
function filterCollapsedSteps(
  rows: TrajectoryRow[],
  turn: number | null,
  collapsedSteps: Record<string, boolean>,
): TrajectoryRow[] {
  const out: TrajectoryRow[] = []
  let hiding: string | null = null
  for (const row of rows) {
    if (hiding) {
      if (row.type === 'step/end' && turn != null && row.step != null && `${turn}:${row.step}` === hiding) {
        hiding = null
      }
      continue
    }
    out.push(row)
    if (row.type === 'step/start' && turn != null && row.step != null) {
      const key = `${turn}:${row.step}`
      if (collapsedSteps[key]) hiding = key
    }
  }
  return out
}

function EventDetailBody({ event, events }: { event: SessionEvent; events: SessionEvent[] }) {
  const fields = detailFields(event, events)
  const usage = event.type === 'assistant/message' ? event.usage : undefined
  const request =
    event.type === 'assistant/message' ? projectRequestMessages(events, event.seq) : undefined
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
      {request ? <RequestPanel messages={request} /> : null}
      {event.type === 'assistant/message' ? (
        <ResponsePanel event={event} />
      ) : (
        <pre className="traj-detail-json">{JSON.stringify(event, null, 2)}</pre>
      )}
    </div>
  )
}

function RequestPanel({ messages }: { messages: DerivedMessage[] }) {
  return (
    <section className="traj-io-card" aria-label="LLM request">
      <div className="traj-io-card-title">Request · derived ({messages.length})</div>
      <div className="traj-io-list">
        {messages.map((message, index) => (
          <article key={`${message.role}-${index}`} className="traj-io-msg">
            <header className="traj-io-msg-head">
              <span className={`traj-io-role traj-io-role-${message.role}`}>{message.role}</span>
              {message.tool_call_id ? <span className="traj-io-meta">#{message.tool_call_id}</span> : null}
              {message.tool_calls?.length ? (
                <span className="traj-io-meta">{message.tool_calls.length} tool_calls</span>
              ) : null}
            </header>
            {message.content ? <pre className="traj-io-msg-body">{message.content}</pre> : null}
            {message.tool_calls?.length ? (
              <pre className="traj-io-msg-body traj-io-msg-tools">
                {JSON.stringify(message.tool_calls, null, 2)}
              </pre>
            ) : null}
            {!message.content && !message.tool_calls?.length ? (
              <pre className="traj-io-msg-body traj-io-msg-empty">(empty content)</pre>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

function ResponsePanel({ event }: { event: Extract<SessionEvent, { type: 'assistant/message' }> }) {
  return (
    <section className="traj-io-card" aria-label="LLM response">
      <div className="traj-io-card-title">Response · assistant/message</div>
      {event.text ? <pre className="traj-io-msg-body">{event.text}</pre> : null}
      {event.tool_calls?.length ? (
        <pre className="traj-io-msg-body traj-io-msg-tools">{JSON.stringify(event.tool_calls, null, 2)}</pre>
      ) : null}
      {!event.text && !event.tool_calls?.length ? <pre className="traj-io-msg-body traj-io-msg-empty">(empty)</pre> : null}
    </section>
  )
}

function detailFields(event: SessionEvent, events: SessionEvent[]): Array<{ label: string; value: string }> {
  if (event.type === 'user/message' || event.type === 'assistant/chunk' || event.type === 'system/prompt') {
    return [
      ...(event.type === 'user/message' && event.kind ? [{ label: 'kind', value: event.kind }] : []),
      { label: 'text', value: `${event.text.length} chars` },
    ]
  }
  if (event.type === 'assistant/message') {
    const rows = [{ label: 'text', value: `${event.text.length} chars` }]
    if (event.tool_calls?.length) rows.push({ label: 'tool_calls', value: String(event.tool_calls.length) })
    const requestCount = projectRequestMessages(events, event.seq).length
    rows.push({ label: 'request', value: `${requestCount} messages (derived)` })
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
