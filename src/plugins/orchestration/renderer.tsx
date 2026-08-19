import { useSyncExternalStore, type ReactNode } from 'react'
import { SlotEvent, type SlotEntry, type SlotKind, type SlotsService } from '../registry/slots.ts'

function Outlet({ slots, name, kind }: { slots: SlotsService; name: string; kind?: SlotKind }) {
  useSyncExternalStore(
    (fn) => slots.subscribe(name, SlotEvent.Entries, fn),
    () => slots.getVersion(name),
    () => slots.getVersion(name),
  )
  const resolved = slots.specOf(name)?.kind ?? kind ?? 'list'
  const entries = slots.list(name)
  const visible =
    resolved === 'single'
      ? entries.slice(0, 1)
      : [...entries].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  return (
    <>
      {visible.map((entry) => (
        <EntryView key={entry.id} slots={slots} entry={entry} />
      ))}
    </>
  )
}

function EntryView({ slots, entry }: { slots: SlotsService; entry: SlotEntry }) {
  const extra = entry.props?.() ?? {}
  return (
    <entry.Component
      {...extra}
      renderSlot={(name, options) => <Outlet slots={slots} name={name} kind={options?.kind} />}
    />
  )
}

export function renderRoot(slots: SlotsService): ReactNode {
  return <Outlet slots={slots} name="root" kind="single" />
}
