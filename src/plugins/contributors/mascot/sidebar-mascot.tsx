import { memo } from 'react'
import { CursorAvatar, type CursorState } from './cursor-avatar.tsx'

/** Cream-on-dark friendly body gradient (matches app neutrals, not loud brand orange). */
const SIDEBAR_GRADIENT: [string, string, string] = ['#f2f1ed', '#a8a59c', '#5c5a54']

export type SidebarMascotProps = {
  size?: number
  /** Map from agent liveness */
  busy?: boolean
  className?: string
  title?: string
}

function stateFor(busy: boolean): CursorState {
  return busy ? 'working' : 'idle'
}

/** OpenMausBot / Blob Studio cursor mascot — Grok-Bot–style animated sidebar face. */
export const SidebarMascot = memo(function SidebarMascot({
  size = 28,
  busy = false,
  className,
  title = 'Harness',
}: SidebarMascotProps) {
  return (
    <CursorAvatar
      state={stateFor(busy)}
      size={size}
      gradient={SIDEBAR_GRADIENT}
      eyeColor="#14120f"
      lookAround={0.35}
      effects={false}
      glyphs={false}
      motion={busy ? 0.85 : 0.55}
      className={className}
      title={title}
    />
  )
})
