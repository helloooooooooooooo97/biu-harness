import { memo, useEffect, useState } from 'react'
import {
  SIDEBAR_MASCOT_INTRO_MS,
  clearSidebarMascotFresh,
  remainingSidebarMascotIntroMs,
} from '../../infrastructure/session-mascot-fresh.ts'
import { GrokBotAvatar } from './grok-bot-avatar.tsx'
import { StaticMascotMark } from './static-mascot-mark.tsx'
import type { SessionMascotIdentity } from './grok-bot-types.ts'
import { DEFAULT_SESSION_MASCOT } from './session-mascot.ts'

export { SIDEBAR_MASCOT_INTRO_MS, markSidebarMascotFresh } from '../../infrastructure/session-mascot-fresh.ts'

export type SidebarMascotProps = {
  size?: number
  busy?: boolean
  /** 用于匹配 markSidebarMascotFresh；有剩余 intro 时才播放动画 */
  sessionId?: string
  className?: string
  title?: string
  /** Per-chat role; defaults to brand mascot when omitted. */
  identity?: SessionMascotIdentity
  paused?: boolean
  followPointer?: boolean
}

/**
 * 侧栏头像：空闲用静态描边（轻）；仅 intro / busy 才挂完整 GrokCharacter。
 */
export const SidebarMascot = memo(function SidebarMascot({
  size = 44,
  busy = false,
  sessionId,
  className,
  title = 'Harness',
  identity = DEFAULT_SESSION_MASCOT,
  paused = false,
  followPointer = false,
}: SidebarMascotProps) {
  const [introMs, setIntroMs] = useState(() => remainingSidebarMascotIntroMs(sessionId))

  useEffect(() => {
    const left = remainingSidebarMascotIntroMs(sessionId)
    setIntroMs(left)
    if (left <= 0) return
    const timer = window.setTimeout(() => {
      if (sessionId) clearSidebarMascotFresh(sessionId)
      setIntroMs(0)
    }, left)
    return () => window.clearTimeout(timer)
  }, [sessionId])

  const animated = busy || introMs > 0

  if (!animated) {
    return (
      <StaticMascotMark
        identity={identity}
        size={size}
        busy={false}
        className={className}
        title={title}
      />
    )
  }

  return (
    <GrokBotAvatar
      shape={identity.shape}
      color={identity.color}
      size={size}
      busy={busy}
      introMs={introMs}
      paused={paused}
      followPointer={followPointer}
      className={className}
      title={title}
    />
  )
})
