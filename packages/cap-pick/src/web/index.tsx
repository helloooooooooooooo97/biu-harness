import type { Context } from 'cordis'
import type { SlotsService } from '@biu/web-slots'
import { PickService } from './service.ts'
import { PickOverlay } from './overlay.tsx'
import { PickToggle } from './toggle.tsx'

export { PickService, usePickState } from './service.ts'
export { formatPicks, parsePicks, chipLabel, pickKey, type PickRef } from './types.ts'
export { PickChipLabel, PickKindGlyph, pickKindIcon } from './chip.tsx'
export { resolvePickFromNode, resolvePickAtPoint, resolvePicksInRect } from './resolve.ts'

export const name = 'pick-ui'
export const inject = ['slots']

export function apply(ctx: Context) {
  const pick = new PickService(ctx)
  const slots = ctx.slots as SlotsService
  slots.place('header-tools', PickToggle, {
    key: 'pick-toggle',
    order: 10,
    props: () => ({ pick }),
  })
  slots.place('root-overlays', PickOverlay, {
    key: 'pick-overlay',
    order: 10,
    props: () => ({ pick }),
  })
}

declare module 'cordis' {
  interface Context {
    pick: PickService
  }
}
