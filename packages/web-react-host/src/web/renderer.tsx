import { useSyncExternalStore, type ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { SlotEvent, SlotOutlet, type SlotsService } from '@biu/web-slots'
import type { AppModulesService } from '@biu/web-app-modules'

function AppShell({ slots }: { slots: SlotsService }) {
  return <SlotOutlet slots={slots} name="root" kind="single" />
}

/** 单壳常驻：路由变化不卸载 Shell，避免 Chat/Debug/模块切换整树重挂。未知路径也不踢回首页，等插件登记完再认。 */
function Root({ slots, modules }: { slots: SlotsService; modules?: AppModulesService }) {
  useSyncExternalStore(
    modules?.subscribe ?? ((fn: () => void) => {
      void fn
      return () => undefined
    }),
    modules?.version ?? (() => 0),
    modules?.version ?? (() => 0),
  )
  return <AppShell slots={slots} />
}

export function renderRoot(slots: SlotsService, modules?: AppModulesService): ReactNode {
  return (
    <BrowserRouter>
      <Root slots={slots} modules={modules} />
    </BrowserRouter>
  )
}
