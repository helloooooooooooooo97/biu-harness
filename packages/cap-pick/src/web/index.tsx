import type { Context } from 'cordis'
import type { SlotsService } from '@biu/web-slots'
import { CursorArrowRaysIcon } from '@heroicons/react/16/solid'
import { PickService, getPick, usePickState } from './service.ts'
import { PickOverlay } from './overlay.tsx'

export { PickService, usePickState } from './service.ts'
export { formatPicks, formatPick, parsePicks, splitPickStream, dedupePicks, chipLabel, pickKey, pickPreview, pickDomAttrs, type PickRef } from './types.ts'
export { PickChip, PickChipLabel, PickKindGlyph, pickKindIcon, pickKindTone } from './chip.tsx'
export { resolvePickFromNode, resolvePickAtPoint, resolvePicksInRect, visiblePickBox } from './resolve.ts'

export const name = 'pick-ui'
export const inject = ['slots']

function PickToggle() {
  const pick = getPick()
  const state = usePickState(pick)
  return (
    <button
      type="button"
      className="project-chip project-chip-icon-only relative"
      aria-pressed={state.picking}
      aria-label="选取"
      data-dock-tip="选取"
      data-testid="pick-toggle"
      onClick={() => pick?.toggle()}
    >
      <CursorArrowRaysIcon className="size-4" aria-hidden />
    </button>
  )
}

export function apply(ctx: Context) {
  new PickService(ctx)
  const slots = ctx.slots as SlotsService
  slots.place('root-overlays', PickOverlay, {
    key: 'pick-overlay',
    order: 10,
  })
  slots.place('header-tools', PickToggle, {
    key: 'pick-toggle',
    order: 10,
  })
}

declare module 'cordis' {
  interface Context {
    pick: PickService
  }
}
