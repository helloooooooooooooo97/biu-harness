import { useSyncExternalStore, type ReactNode } from 'react'
import type { SlotRenderer, SlotRendererHost } from '../ui-slots/index.ts'
import type { SlotProps, StoredEntry } from '../ui-slots/types.ts'
import { bindSnapshotSelector } from './bind.ts'
import type { Snapshot } from '../runtime/snapshot.ts'

function Outlet({ host, name }: { host: SlotRendererHost; name: string }) {
  useSyncExternalStore(
    (fn) => host.subscribe(name, fn),
    () => host.getVersion(name),
  )
  const spec = host.specOf(name)
  const entries = host.entriesOf(name)
  const visible = spec?.kind === 'single' ? entries.slice(0, 1) : entries
  return (
    <>
      {visible.map((entry) => (
        <EntryView key={entry.id} host={host} entry={entry} />
      ))}
    </>
  )
}

function EntryView({ host, entry }: { host: SlotRendererHost; entry: StoredEntry }) {
  const face = entry.inject?.() ?? {}
  const { hooks, ...plain } = face
  const snapshotSource = hooks?.snapshot
  const useSnapshot = snapshotSource
    ? bindSnapshotSelector(snapshotSource as { getSnapshot: () => Snapshot; subscribe: (fn: () => void) => () => void })
    : (<S,>(sel: (state: unknown) => S): S => sel({}))

  const props: SlotProps = {
    ...plain,
    useSnapshot,
    renderSlot: (child: string) => {
      if (!entry.children.includes(child)) {
        throw new Error(`renderSlot("${child}") 不在该条目的 children 声明里`)
      }
      return <Outlet host={host} name={child} />
    },
  }
  return <entry.Component {...props} />
}

export function createSlotRenderer(): SlotRenderer {
  return {
    renderRoot(host) {
      return <Outlet host={host} name="root" />
    },
  }
}
