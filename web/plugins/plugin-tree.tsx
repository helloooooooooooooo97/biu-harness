import type { Context } from 'cordis'
import type { SlotProps } from '../ui-slots/types.ts'
import type { Snapshot } from '../runtime/snapshot.ts'

export const name = 'plugin-tree'
export const inject = ['slots', 'snapshot']

function PluginTree(props: SlotProps) {
  const snap = props.useSnapshot((state) => state as Snapshot)
  const setEnabled = props.setEnabled as (id: string, enabled: boolean) => Promise<void>
  return (
    <ul>
      {snap.plugins.map((plugin) => (
        <li className="plugin" key={plugin.id}>
          <div>
            <h3>{plugin.name}</h3>
            <div className="meta">
              {plugin.layer} · {plugin.state}
              {plugin.inject.length ? ` · inject ${plugin.inject.join(', ')}` : ''}
            </div>
          </div>
          <button
            className="toggle"
            aria-checked={plugin.enabled}
            disabled={!plugin.togglable}
            onClick={() => void setEnabled(plugin.id, !plugin.enabled)}
          />
          <p>{plugin.blurb}</p>
        </li>
      ))}
    </ul>
  )
}

export function apply(ctx: Context) {
  ctx.slots.inject('sidebar', () =>
    ctx.slots.register(
      {
        name: 'sidebar',
        inject: () => ({
          hooks: { snapshot: ctx.snapshot },
          setEnabled: (id: string, enabled: boolean) => ctx.snapshot.setEnabled(id, enabled),
        }),
      },
      PluginTree,
    ),
  )
}
