import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'
import { bindSnapshot, type Snapshot, type SnapshotService } from '../infrastructure/snapshot.ts'

export const name = 'clock-ui'
export const inject = ['slots', 'snapshot']

function formatClock(iso?: string) {
  if (!iso) return 'waiting…'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

function ClockBadge(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const iso = useSnapshot((state: Snapshot) => state.clockIso)
  return (
    <article className="space-y-1 rounded-[12px] border border-[var(--dsw-border)] bg-white px-3 py-3">
      <h2 className="text-sm font-medium">Heartbeat</h2>
      <time className="font-mono text-sm tracking-wide text-[var(--dsw-label-3)]" dateTime={iso}>
        {formatClock(iso)}
      </time>
    </article>
  )
}

export function apply(ctx: Context) {
  ctx.slots.place('demos', ClockBadge, {
    key: 'clock',
    order: 5,
    props: () => ({ useSnapshot: bindSnapshot(ctx.snapshot as SnapshotService) }),
  })
}
