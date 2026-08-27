import { LuMousePointer2 } from 'react-icons/lu'
import type { PickService } from './service.ts'
import { usePickState } from './service.ts'

export function PickToggle({ pick }: { pick: PickService }) {
  const { picking } = usePickState(pick)
  return (
    <button
      type="button"
      className={`chat-view-header-expand${picking ? ' is-active' : ''}`}
      title="选取对象"
      aria-label="选取对象"
      aria-pressed={picking}
      data-testid="header-pick-toggle"
      data-biu-ignore
      onClick={() => pick.toggle()}
    >
      <LuMousePointer2 className="size-3.5" />
    </button>
  )
}
