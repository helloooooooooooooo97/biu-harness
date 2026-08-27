import { LuMousePointer2 } from 'react-icons/lu'
import type { PickService } from './service.ts'
import { usePickState } from './service.ts'

export function PickToggle({ pick }: { pick: PickService }) {
  const { picking } = usePickState(pick)
  return (
    <button
      type="button"
      className={`project-chip project-chip-icon-only${picking ? ' is-active' : ''}`}
      title="选取对象"
      aria-label="选取对象"
      aria-pressed={picking}
      data-testid="header-pick-toggle"
      data-biu-ignore
      onClick={() => pick.toggle()}
    >
      <LuMousePointer2 className="project-chip-icon" />
    </button>
  )
}
