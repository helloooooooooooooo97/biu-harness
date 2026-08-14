import type { Context } from 'cordis'
import type { SlotProps } from '../ui-slots/types.ts'
import type { Snapshot } from '../runtime/snapshot.ts'

export const name = 'event-log'
export const inject = ['slots', 'snapshot']

function EventLog(props: SlotProps) {
  const events = props.useSnapshot((state) => (state as Snapshot).events)
  return (
    <ol>
      {(events || []).map((item, index) => (
        <li key={`${item.ts}-${index}`}>
          <span className="dim">{item.mode}</span> {item.name}
          <br />
          {JSON.stringify(item.args).slice(0, 140)}
        </li>
      ))}
    </ol>
  )
}

export function apply(ctx: Context) {
  ctx.slots.inject('log', () =>
    ctx.slots.register(
      {
        name: 'log',
        inject: () => ({ hooks: { snapshot: ctx.snapshot } }),
      },
      EventLog,
    ),
  )
}
