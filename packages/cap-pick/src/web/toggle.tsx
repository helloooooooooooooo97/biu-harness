import { CursorArrowRaysIcon } from '@heroicons/react/16/solid'
import type { SlotProps } from '@biu/type-slots'
import { getPick, usePickState } from './service.ts'

export function PickToggle(props: SlotProps) {
  const pick = getPick()
  const { picking } = usePickState(pick)
  const placement = String(props.placement ?? 'header')
  return (
    <button
      type="button"
      className={`project-chip project-chip-icon-only${picking ? ' is-active' : ''}`}
      aria-label="选取对象"
      data-dock-tip="选取对象"
      aria-pressed={picking}
      data-testid={placement === 'corner' ? 'corner-pick-toggle' : 'header-pick-toggle'}
      data-biu-ignore
      onClick={() => pick?.toggle()}
    >
      <CursorArrowRaysIcon className="size-4" />
    </button>
  )
}
