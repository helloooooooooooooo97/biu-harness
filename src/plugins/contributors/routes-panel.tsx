import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'
import { bindSnapshot, type Snapshot, type SnapshotService } from '../infrastructure/snapshot.ts'

export const name = 'routes-panel'
export const inject = ['slots', 'snapshot']

function RoutesPanel(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const routes = useSnapshot((state: Snapshot) => state.routes)
  return (
    <ul className="m-0 list-none space-y-1 p-0 font-mono text-xs text-[var(--dsw-business)]">
      {routes.map((route) => (
        <li key={`${route.method}:${route.pattern}`}>
          {route.method} {route.pattern}
        </li>
      ))}
    </ul>
  )
}

export function apply(ctx: Context) {
  ctx.slots.place('routes', RoutesPanel, {
    key: 'routes',
    props: () => ({ useSnapshot: bindSnapshot(ctx.snapshot as SnapshotService) }),
  })
}
