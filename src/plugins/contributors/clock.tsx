import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'
import { bindSnapshot, type Snapshot, type SnapshotService } from '../infrastructure/snapshot.ts'

export const name = 'clock-ui'
export const inject = ['slots', 'snapshot']

function ClockCard(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const iso = useSnapshot((state: Snapshot) => state.clockIso)
  return (
    <article className="max-w-[90%] rounded-2xl bg-[#2d2e30] px-4 py-3">
      <h2 className="mb-1 text-sm font-medium">心跳</h2>
      <p className="text-sm leading-6 text-[#9aa0a6]">经 fill.props 注入 useSnapshot，不直接 import host。</p>
      <div className="mt-2 font-mono text-sm tracking-wide text-[#8ab4f8]">{iso || '等待 tick…'}</div>
    </article>
  )
}

export function apply(ctx: Context) {
  ctx.slots.inject('stage', () =>
    ctx.slots.fill('stage', ClockCard, {
      key: 'clock',
      order: 30,
      props: () => ({ useSnapshot: bindSnapshot(ctx.snapshot as SnapshotService) }),
    }),
  )
}
