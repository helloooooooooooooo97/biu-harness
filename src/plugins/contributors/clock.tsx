import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'
import { bindSnapshot, type Snapshot, type SnapshotService } from '../infrastructure/snapshot.ts'

export const name = 'clock-ui'
export const inject = ['slots', 'snapshot']

function formatClock(iso?: string) {
  if (!iso) return '等待 tick…'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

function ClockBadge(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const iso = useSnapshot((state: Snapshot) => state.clockIso)
  return (
    <article className="space-y-1 rounded-2xl bg-[#2d2e30] px-3 py-3">
      <h2 className="text-sm font-medium">心跳</h2>
      <time className="font-mono text-sm tracking-wide text-[#9aa0a6]" dateTime={iso}>
        {formatClock(iso)}
      </time>
    </article>
  )
}

export function apply(ctx: Context) {
  ctx.slots.place('rail', ClockBadge, {
    key: 'clock',
    order: 5,
    props: () => ({ useSnapshot: bindSnapshot(ctx.snapshot as SnapshotService) }),
  })
}
