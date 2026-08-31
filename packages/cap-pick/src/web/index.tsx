import type { Context } from 'cordis'
import type { SlotsService } from '@biu/web-slots'
import { CursorArrowRaysIcon } from '@heroicons/react/16/solid'
import { PickService } from './service.ts'
import { PickOverlay } from './overlay.tsx'
import { PickToggle } from './toggle.tsx'

export { PickService, usePickState } from './service.ts'
export { formatPicks, formatPick, parsePicks, splitPickStream, dedupePicks, chipLabel, pickKey, pickPreview, pickDomAttrs, type PickRef } from './types.ts'
export { PickChipLabel, PickKindGlyph, pickKindIcon } from './chip.tsx'
export { resolvePickFromNode, resolvePickAtPoint, resolvePicksInRect } from './resolve.ts'

export const name = 'pick-ui'
export const inject = ['slots', 'dock']

function PickDockIcon() {
  return <CursorArrowRaysIcon className="size-5" />
}

export function apply(ctx: Context) {
  const pick = new PickService(ctx)
  const slots = ctx.slots as SlotsService
  slots.place('header-tools', PickToggle, {
    key: 'pick-toggle',
    order: 10,
    props: () => ({ placement: 'header' }),
  })
  slots.place('root-overlays', PickOverlay, {
    key: 'pick-overlay',
    order: 10,
    props: () => ({}),
  })
  ctx.dock.register({
    id: 'pick',
    title: '选取',
    kind: 'tool',
    order: 20,
    Icon: PickDockIcon,
    onOpen: () => pick.toggle(),
  })
  ctx.effect(() =>
    pick.subscribe(() => {
      ctx.dock.patch('pick', { running: pick.picking, focused: pick.picking })
    }),
  )
}

declare module 'cordis' {
  interface Context {
    pick: PickService
  }
}
