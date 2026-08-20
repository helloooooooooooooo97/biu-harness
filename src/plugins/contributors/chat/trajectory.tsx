import { useEffect, useMemo } from 'react'
import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'
import type { TrajectoryRow } from '../../infrastructure/session-project.ts'

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

function shortType(type: TrajectoryRow['type']) {
  const parts = type.split('/')
  return parts[parts.length - 1] || type
}

const toneClass: Record<TagTone, string> = {
  user: 'traj-tag traj-tag-user',
  assistant: 'traj-tag traj-tag-assistant',
  tool: 'traj-tag traj-tag-tool',
  system: 'traj-tag traj-tag-system',
  turn: 'traj-tag traj-tag-turn',
  step: 'traj-tag traj-tag-step',
}

export function TrajectoryView(props: SlotProps) {
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const rows = useSessionView((state) => state.trajectory)
  const focusCallId = useSessionView((state) => state.focusCallId)
  const sessionId = useSessionView((state) => state.sessionId)

  const groups = useMemo(() => groupByTurn(rows), [rows])

  useEffect(() => {
    if (!focusCallId) return
    document.getElementById(`traj-call-${focusCallId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusCallId, rows])

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
    <div className="traj-root">
      <div className="traj-meta">
        <span>{rows.length} events</span>
        <span className="traj-meta-sep">·</span>
        <span>{groups.length} turns</span>
      </div>

      <div className="traj-head" role="row">
        <span className="traj-col-seq">#</span>
        <span className="traj-col-type">type</span>
        <span className="traj-col-summary">summary</span>
      </div>

      <div className="traj-list" role="rowgroup">
        {groups.map((group) => (
          <div key={group.key} className="traj-group">
            <div className="traj-group-bar">
              <span>{group.turn == null ? 'meta' : `Turn ${group.turn}`}</span>
              <span>{group.rows.length}</span>
            </div>
            {group.rows.map((row) => {
              const focused = Boolean(focusCallId && row.callId === focusCallId)
              const tone = toneOf(row.type)
              return (
                <div
                  key={row.id}
                  id={row.callId ? `traj-call-${row.callId}` : undefined}
                  role="row"
                  className={`traj-row traj-depth-${row.depth}${focused ? ' traj-row-focus' : ''}`}
                >
                  <span className="traj-col-seq">{row.seq}</span>
                  <span className="traj-col-type">
                    <span className={toneClass[tone]} title={row.type}>
                      {shortType(row.type)}
                    </span>
                  </span>
                  <span className="traj-col-summary" title={row.summary}>
                    {row.summary}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
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
