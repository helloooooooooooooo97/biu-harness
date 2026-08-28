import { CursorArrowRaysIcon } from '@heroicons/react/16/solid'
import type { SlotProps } from '@biu/type-slots'
import type { PickService } from './service.ts'
import { usePickState } from './service.ts'

export function PickToggle(props: SlotProps) {
  const pick = props.pick as PickService
  const { picking } = usePickState(pick)
  return (
    <button
      type="button"
      className={`project-chip project-chip-icon-only${picking ? ' is-active' : ''}`}
      aria-label="选取对象"
      data-dock-tip="选取对象"
      aria-pressed={picking}
      data-testid="header-pick-toggle"
      data-biu-ignore
      onClick={() => pick.toggle()}
    >
      <CursorArrowRaysIcon className="size-4" />
    </button>
  )
}
