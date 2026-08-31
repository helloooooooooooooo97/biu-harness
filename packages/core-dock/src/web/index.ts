import type { Context } from 'cordis'
import { OsDock } from './os-dock.tsx'
import { DockService } from './service.ts'

export const name = 'core-dock'
export const inject = ['slots']

export function apply(ctx: Context) {
  const dock = new DockService(ctx)
  ctx.slots.place('root-overlays', OsDock, {
    key: 'os-dock',
    order: 5,
    props: () => ({ dock }),
  })
}

export { DockService, OsDock }
export type { DockApp, DockAppInput, DockGroup, DockKind, DockSnapshot } from './service.ts'

declare module 'cordis' {
  interface Context {
    dock: DockService
  }
}
