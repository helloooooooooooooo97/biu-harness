import type { Context } from 'cordis'
import type { SlotProps } from '@biu/web-slots'
import { bindSnapshot, type Snapshot, type SnapshotService } from '@biu/web-snapshot'

export const name = 'event-log'
export const inject = ['slots', 'snapshot']

function EventLog(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const events = useSnapshot((state: Snapshot) => state.events)
  return (
    <ol className="m-0 max-h-48 list-none overflow-y-auto p-0 font-mono text-xs text-(--dsw-label-3)">
      {(events || []).map((item, index) => (
        <li className="border-b border-(--dsw-border) py-1.5 last:border-0" key={`${item.ts}-${index}`}>
          <span className="text-(--dsw-label-3)">{item.mode}</span> {item.name}
        </li>
      ))}
    </ol>
  )
}

export function apply(ctx: Context) {
  ctx.slots.place('log', EventLog, {
    key: 'event-log',
    props: () => ({ useSnapshot: bindSnapshot(ctx.snapshot as SnapshotService) }),
  })
}
