import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'
import { bindSnapshot, type Snapshot } from '../infrastructure/snapshot.ts'

export const name = 'plugin-tree'
export const inject = ['slots', 'snapshot']

function PluginTree(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const setEnabled = props.setEnabled as (id: string, enabled: boolean) => Promise<void>
  const snap = useSnapshot((state: Snapshot) => state.plugins)
  return (
    <ul className="m-0 list-none space-y-2 p-0">
      {snap.map((plugin) => (
        <li className="rounded-[12px] border border-[var(--dsw-border)] bg-[var(--dsw-surface)] px-3 py-3" key={plugin.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="m-0 text-sm font-medium">{plugin.name}</h3>
              <div className="mt-0.5 text-xs text-[var(--dsw-label-3)]">
                {plugin.layer} · {plugin.state}
              </div>
            </div>
            <button
              className="toggle"
              type="button"
              aria-checked={plugin.enabled}
              disabled={!plugin.togglable}
              onClick={() => void setEnabled(plugin.id, !plugin.enabled)}
            />
          </div>
          <p className="mt-2 mb-0 text-sm leading-5 text-[var(--dsw-label-3)]">{plugin.blurb}</p>
        </li>
      ))}
    </ul>
  )
}

export function apply(ctx: Context) {
  ctx.slots.place('sidebar', PluginTree, {
    key: 'plugin-tree',
    props: () => ({
      useSnapshot: bindSnapshot(ctx.snapshot),
      setEnabled: (id: string, enabled: boolean) => ctx.snapshot.setEnabled(id, enabled),
    }),
  })
}
