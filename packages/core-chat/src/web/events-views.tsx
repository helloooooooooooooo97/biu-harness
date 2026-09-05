import { useCallback, useEffect, useState } from 'react'
import { MapIcon, SignalIcon } from '@heroicons/react/16/solid'
import type { DbRecord } from '@biu/type-file-system'
import type { CollectionChrome, CollectionViewType, FsViewProps } from '@biu/type-file-system/ui'
import type { TrajectoryRow } from '@biu/web-session-view'
import { TrajectoryView } from './trajectory.tsx'
import { UsagePanel } from './usage-panel.tsx'

const EVENTS_TRAJ_VIEW_ID = 'builtin-traj:/events'
const EVENTS_USAGE_VIEW_ID = 'builtin-usage:/events'

function uniqueSessionId(rows: DbRecord[]) {
  const ids = [...new Set(rows.map((row) => String(row.sessionId ?? '').trim()).filter(Boolean))]
  return ids.length === 1 ? ids[0]! : ''
}

function bindSessionId(sessionId: string) {
  return <T,>(select: (state: { sessionId: string }) => T) => select({ sessionId })
}

type TrajPayload = { rows?: TrajectoryRow[]; hasMore?: boolean }

function EventsTrajView({ rows }: FsViewProps) {
  const sessionId = uniqueSessionId(rows)
  const [pack, setPack] = useState<{ rows: TrajectoryRow[]; hasMore: boolean; loading: boolean }>({
    rows: [],
    hasMore: false,
    loading: false,
  })
  useEffect(() => {
    if (!sessionId) {
      setPack({ rows: [], hasMore: false, loading: false })
      return
    }
    let cancelled = false
    setPack((prev) => ({ ...prev, loading: true }))
    void fetch(`/api/sessions/${sessionId}/trajectory?turns=8`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: TrajPayload | null) => {
        if (cancelled) return
        setPack({
          rows: Array.isArray(body?.rows) ? body.rows : [],
          hasMore: Boolean(body?.hasMore),
          loading: false,
        })
      })
      .catch(() => {
        if (!cancelled) setPack({ rows: [], hasMore: false, loading: false })
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])
  const useSessionView = useCallback(
    <T,>(select: (state: {
      sessionId: string
      trajectory: TrajectoryRow[]
      trajectoryHasMore: boolean
      trajectoryLoading: boolean
      focusCallId: string
      dispatchedUsage: undefined
    }) => T) =>
      select({
        sessionId,
        trajectory: pack.rows,
        trajectoryHasMore: pack.hasMore,
        trajectoryLoading: pack.loading,
        focusCallId: '',
        dispatchedUsage: undefined,
      }),
    [pack.hasMore, pack.loading, pack.rows, sessionId],
  )
  if (!sessionId) {
    return <p className="fsdb-empty">按会话筛选后再看轨迹</p>
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="events-traj-view">
      <TrajectoryView useSessionView={useSessionView} />
    </div>
  )
}

function EventsUsageView({ rows }: FsViewProps) {
  const sessionId = uniqueSessionId(rows)
  if (!sessionId) return <p className="fsdb-empty">按会话筛选后再看用量</p>
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-2.5" data-testid="events-usage-view">
      <UsagePanel useSessionView={bindSessionId(sessionId)} />
    </div>
  )
}

export const eventsTrajViewType: CollectionViewType = {
  id: 'traj',
  label: '轨迹',
  Icon: MapIcon,
  View: EventsTrajView,
}

export const eventsUsageViewType: CollectionViewType = {
  id: 'usage',
  label: '用量',
  Icon: SignalIcon,
  View: EventsUsageView,
}

function asUserViews(user: unknown[]) {
  return user.filter((item) => {
    if (!item || typeof item !== 'object') return false
    const view = item as { builtin?: unknown; id?: unknown }
    return !view.builtin && view.id !== EVENTS_TRAJ_VIEW_ID && view.id !== EVENTS_USAGE_VIEW_ID
  })
}

export const eventsChrome: CollectionChrome = {
  listViews(_tables, user) {
    return [
      {
        id: 'builtin-all:/events',
        name: '全部事件',
        mode: 'table',
        sortField: 'ts',
        sortDir: 'desc',
        filters: {},
        columns: [],
        groupBy: '',
        tree: true,
        wrap: false,
        truncate: true,
        query: '',
        builtin: true,
      },
      {
        id: EVENTS_TRAJ_VIEW_ID,
        name: '轨迹',
        mode: 'traj',
        sortField: 'ts',
        sortDir: 'desc',
        filters: {},
        columns: [],
        groupBy: '',
        tree: true,
        wrap: false,
        truncate: true,
        query: '',
        builtin: true,
      },
      {
        id: EVENTS_USAGE_VIEW_ID,
        name: '用量',
        mode: 'usage',
        sortField: 'ts',
        sortDir: 'desc',
        filters: {},
        columns: [],
        groupBy: '',
        tree: true,
        wrap: false,
        truncate: true,
        query: '',
        builtin: true,
      },
      ...asUserViews(user),
    ]
  },
}
