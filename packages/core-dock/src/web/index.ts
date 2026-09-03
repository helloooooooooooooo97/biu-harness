import type { Context } from 'cordis'
import { OsDock } from './os-dock.tsx'
import { DockService } from './service.ts'

export const name = 'core-dock'
export const inject = ['slots']

export function apply(ctx: Context) {
  new DockService(ctx)
}

export { DockService, OsDock }
export type { DockApp, DockAppInput, DockGroup, DockKind, DockSnapshot } from './service.ts'

declare module 'cordis' {
  interface Context {
    dock: DockService
  }
}
