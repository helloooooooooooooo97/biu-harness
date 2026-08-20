import { useSyncExternalStore, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
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

function AppShell({ slots }: { slots: SlotsService }) {
  return <Outlet slots={slots} name="root" kind="single" />
}

export function renderRoot(slots: SlotsService): ReactNode {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell slots={slots} />} />
        <Route path="/workspace" element={<AppShell slots={slots} />} />
        <Route path="/s/:sessionId" element={<AppShell slots={slots} />} />
        <Route path="/s/:sessionId/chat" element={<AppShell slots={slots} />} />
        <Route path="/s/:sessionId/trajectory" element={<AppShell slots={slots} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
