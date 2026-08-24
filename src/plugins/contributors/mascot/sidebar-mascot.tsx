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
  /**
   * 是否挂完整 GrokCharacter 动画。默认仅 busy/intro 时开。
   * 侧栏非当前会话请传 false：只亮静态绿点，避免多 bot 抢 RAF。
   */
  animate?: boolean
  /** 彩蛋：所有 mascot 一起跳舞。即使 animate=false 也强开完整动画并进入 celebrate 循环。 */
  dancing?: boolean
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
 * 侧栏头像：空闲用静态描边（轻）；busy 用与指挥台相同的呼吸灯（不挂完整 GrokCharacter）。
 * 仅 intro 窗口允许挂完整动画。
 */
export const SidebarMascot = memo(function SidebarMascot({
  size = 44,
  busy = false,
  animate,
  dancing = false,
  sessionId,
  className,
  title = 'Biu',
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

  const allowMotion = animate !== false || dancing
  const animated = allowMotion && (busy || introMs > 0 || dancing)

  if (!animated) {
    return (
      <StaticMascotMark
        identity={identity}
        size={size}
        busy={busy}
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
      dancing={dancing}
      paused={paused}
      followPointer={followPointer}
      className={className}
      title={title}
    />
  )
})
