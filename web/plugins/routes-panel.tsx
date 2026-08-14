import type { Context } from 'cordis'
import type { SlotProps } from '../ui-slots/types.ts'
import type { Snapshot } from '../runtime/snapshot.ts'

export const name = 'routes-panel'
export const inject = ['slots', 'snapshot']

function RoutesPanel(props: SlotProps) {
  const routes = props.useSnapshot((state) => (state as Snapshot).routes)
  return (
    <ul className="route-list">
      {routes.map((route) => (
        <li key={`${route.method}:${route.pattern}`}>
          {route.method} {route.pattern}
        </li>
      ))}
    </ul>
  )
}

export function apply(ctx: Context) {
  ctx.slots.inject('routes', () =>
    ctx.slots.register(
      {
        name: 'routes',
        inject: () => ({ hooks: { snapshot: ctx.snapshot } }),
      },
      RoutesPanel,
    ),
  )
}
