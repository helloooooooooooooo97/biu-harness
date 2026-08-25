import { useCallback, useSyncExternalStore, type ReactNode } from 'react'
import { BrowserRouter, Navigate, useLocation } from 'react-router-dom'
import { SlotEvent, type SlotEntry, type SlotKind, type SlotsService } from '@biu/web-slots'
import type { AppModulesService } from '@biu/web-app-modules'
import { isKnownAppPath } from '@biu/web-session-view'

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
  // props() 须返回稳定对象；renderSlot 稳定后 memo 子树才不会在路由切换时被打穿
  const extra = entry.props?.() ?? {}
  const renderSlot = useCallback(
    (name: string, options?: { kind?: SlotKind }) => <Outlet slots={slots} name={name} kind={options?.kind} />,
    [slots],
  )
  return <entry.Component {...extra} renderSlot={renderSlot} />
}

function AppShell({ slots }: { slots: SlotsService }) {
  return <Outlet slots={slots} name="root" kind="single" />
}

/** 单壳常驻：路由变化不卸载 Shell，避免 Chat/Debug/模块切换整树重挂。 */
function Root({ slots, modules }: { slots: SlotsService; modules?: AppModulesService }) {
  const location = useLocation()
  useSyncExternalStore(
    modules?.subscribe ?? ((fn: () => void) => {
      void fn
      return () => undefined
    }),
    modules?.version ?? (() => 0),
    modules?.version ?? (() => 0),
  )
  const plugins = modules?.plugins() ?? []
  if (!isKnownAppPath(location.pathname, plugins)) {
    return <Navigate to="/" replace />
  }
  return <AppShell slots={slots} />
}

export function renderRoot(slots: SlotsService, modules?: AppModulesService): ReactNode {
  return (
    <BrowserRouter>
      <Root slots={slots} modules={modules} />
    </BrowserRouter>
  )
}
