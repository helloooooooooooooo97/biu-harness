import { memo } from 'react'
import { GrokBotAvatar } from './grok-bot-avatar.tsx'
import type { SessionMascotIdentity } from './grok-bot-types.ts'
import { DEFAULT_SESSION_MASCOT } from './session-mascot.ts'

export type SidebarMascotProps = {
  size?: number
  busy?: boolean
  className?: string
  title?: string
  /** Per-chat role; defaults to brand mascot when omitted. */
  identity?: SessionMascotIdentity
  paused?: boolean
  followPointer?: boolean
}

/** Animated per-session Grok role (stable instance; off-screen pauses RAF). */
export const SidebarMascot = memo(function SidebarMascot({
  size = 44,
  busy = false,
  className,
  title = 'Harness',
  identity = DEFAULT_SESSION_MASCOT,
  paused = false,
  followPointer = false,
}: SidebarMascotProps) {
  return (
    <GrokBotAvatar
      shape={identity.shape}
      color={identity.color}
      size={size}
      busy={busy}
      paused={paused}
      followPointer={followPointer}
      className={className}
      title={title}
    />
  )
})
