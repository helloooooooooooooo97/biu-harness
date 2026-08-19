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
    <time className="font-mono text-sm tracking-wide text-[#9aa0a6]" dateTime={iso}>
      {formatClock(iso)}
    </time>
  )
}

export function apply(ctx: Context) {
  ctx.slots.inject('clock', () =>
    ctx.slots.fill('clock', ClockBadge, {
      key: 'clock',
      props: () => ({ useSnapshot: bindSnapshot(ctx.snapshot as SnapshotService) }),
    }),
  )
}
