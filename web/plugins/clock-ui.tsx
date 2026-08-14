import type { Context } from 'cordis'
import type { SlotProps } from '../ui-slots/types.ts'
import type { Snapshot } from '../runtime/snapshot.ts'

export const name = 'clock-ui'
export const inject = ['slots', 'snapshot']

function ClockCard(props: SlotProps) {
  const iso = props.useSnapshot((state) => (state as Snapshot).clockIso)
  return (
    <article className="card">
      <h3>心跳</h3>
      <p className="sub">runtime 快照经 inject.hooks 绑成 useSnapshot，组件不 import web-react</p>
      <div className="clock">{iso || '等待 tick…'}</div>
    </article>
  )
}

export function apply(ctx: Context) {
  ctx.slots.inject('stage', () =>
    ctx.slots.register(
      {
        name: 'stage',
        key: 'clock',
        inject: () => ({ hooks: { snapshot: ctx.snapshot } }),
      },
      ClockCard,
    ),
  )
}
