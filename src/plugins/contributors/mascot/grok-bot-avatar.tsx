import { memo, useEffect, useRef, useState } from 'react'
import { loadGrokBot } from './grok-bot-loader.ts'
import type { GrokCharacterLike, GrokColor, GrokShape } from './grok-bot-types.ts'

export type GrokBotAvatarProps = {
  shape: GrokShape
  color: GrokColor
  size?: number
  /** Agent running → thinking; else onboarding idle cycle */
  busy?: boolean
  /** Pause RAF work (still paints once). Prefer for inactive list rows. */
  paused?: boolean
  followPointer?: boolean
  className?: string
  title?: string
}

/**
 * Animated Grok Bot character (vendored study replica).
 * One instance owns one SVG + RAF loop; call destroy on unmount.
 */
export const GrokBotAvatar = memo(function GrokBotAvatar({
  shape,
  color,
  size = 44,
  busy = false,
  paused = false,
  followPointer = false,
  className,
  title = 'Session mascot',
}: GrokBotAvatarProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const botRef = useRef<GrokCharacterLike | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadGrokBot().then(() => {
      if (cancelled || !svgRef.current || !window.GrokCharacter) return
      botRef.current?.destroy()
      botRef.current = new window.GrokCharacter(svgRef.current, {
        shape,
        color,
        scheme: 'light',
        loginWrap: true,
        sizePx: size,
        mode: busy ? 'hold' : 'onboarding',
        state: busy ? 'thinking' : 'idle',
        followPointer,
        paused,
        eyeColor: '#f3efe6',
      })
      setReady(true)
    })
    return () => {
      cancelled = true
      botRef.current?.destroy()
      botRef.current = null
    }
    // Recreate only when size / pointer policy changes; shape/color/busy update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, followPointer])

  useEffect(() => {
    const bot = botRef.current
    if (!bot || !ready) return
    bot.setShape(shape)
    bot.setColor(color, 'light')
  }, [shape, color, ready])

  useEffect(() => {
    const bot = botRef.current
    if (!bot || !ready) return
    if (busy) {
      bot.setMode('hold')
      bot.setState('thinking', { resetEyes: false })
    } else {
      bot.setMode('onboarding')
    }
  }, [busy, ready])

  useEffect(() => {
    botRef.current?.setPaused(paused)
  }, [paused, ready])

  return (
    <span
      className={`sidebar-mascot grok-bot-avatar${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size, display: 'inline-grid', placeItems: 'center' }}
      title={title}
    >
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          overflow: 'visible',
          colorScheme: 'light',
          opacity: ready ? 1 : 0.35,
        }}
      />
    </span>
  )
})
