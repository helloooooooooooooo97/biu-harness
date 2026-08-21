import { memo } from 'react'
import { CursorAvatar, DEFAULT_GRADIENT, type CursorState } from './cursor-avatar.tsx'

export type SidebarMascotProps = {
  size?: number
  /** Map from agent liveness */
  busy?: boolean
  className?: string
  title?: string
}

function stateFor(busy: boolean): CursorState {
  return busy ? 'working' : 'happy'
}

/** OpenMausBot / Blob Studio cursor mascot — Grok-Bot–style animated sidebar face. */
export const SidebarMascot = memo(function SidebarMascot({
  size = 44,
  busy = false,
  className,
  title = 'Harness',
}: SidebarMascotProps) {
  return (
    <span
      className="sidebar-mascot"
      style={{ width: size, height: size, display: 'inline-grid', placeItems: 'center' }}
    >
      <CursorAvatar
        state={stateFor(busy)}
        size={size}
        gradient={DEFAULT_GRADIENT}
        eyeColor="#ffffff"
        lookAround={0.45}
        effects={!busy}
        glyphs={false}
        motion={busy ? 0.9 : 0.65}
        className={className}
        title={title}
      />
    </span>
  )
})
