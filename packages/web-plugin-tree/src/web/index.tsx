import type { Context } from 'cordis'
import type { SlotProps } from '@biu/web-slots'
import { bindSnapshot, type Snapshot } from '@biu/web-snapshot'

export const name = 'plugin-tree'
export const inject = ['slots', 'snapshot']

const SECTIONS = [
  { layer: 'host', title: '内核 · Host' },
  { layer: 'web', title: '内核 · Web' },
  { layer: 'capability', title: '能力插件' },
] as const

function PluginTree(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const setEnabled = props.setEnabled as (id: string, enabled: boolean) => Promise<void>
  const snap = useSnapshot((state: Snapshot) => state.plugins)
  return (
    <div className="space-y-5">
      {SECTIONS.map((section) => {
        const rows = snap.filter((plugin) => plugin.layer === section.layer)
        if (!rows.length) return null
        return (
          <section key={section.layer}>
            <h2 className="m-0 mb-2 text-xs font-medium tracking-wide text-[var(--dsw-label-3)]">{section.title}</h2>
            <ul className="m-0 list-none space-y-2 p-0">
              {rows.map((plugin) => (
                <li
                  className="rounded-[12px] border border-[var(--dsw-border)] bg-[var(--dsw-surface)] px-3 py-3"
                  key={`${plugin.layer}:${plugin.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="m-0 text-sm font-medium">{plugin.name}</h3>
                      <div className="mt-0.5 text-xs text-[var(--dsw-label-3)]">
                        {plugin.id} · {plugin.state}
                        {!plugin.togglable ? ' · 不可卸载' : ''}
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
          </section>
        )
      })}
    </div>
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
