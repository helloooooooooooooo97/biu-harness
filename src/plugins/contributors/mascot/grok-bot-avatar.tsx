import { memo, useEffect, useRef, useState } from 'react'
import { loadGrokBot } from './grok-bot-loader.ts'
import {
  applySidebarMood,
  attachSharedTicker,
  detachSharedTicker,
  suppressSidebarTricks,
} from './grok-bot-scheduler.ts'
import type { GrokCharacterLike, GrokColor, GrokShape } from './grok-bot-types.ts'

export type GrokBotAvatarProps = {
  shape: GrokShape
  color: GrokColor
  size?: number
  /** Agent running → thinking; else onboarding expression playlist */
  busy?: boolean
  /** Force-pause (e.g. offscreen). Visibility also auto-pauses. */
  paused?: boolean
  followPointer?: boolean
  className?: string
  title?: string
}

type BotInternal = GrokCharacterLike & {
  paused: boolean
  last: number
  _raf: number
  _tick: (now: number) => void
  trickAt?: number
  celebrateAt?: number
  trick?: unknown
  hopAt?: number
}

/**
 * Animated Grok Bot for the session list.
 * Shared ~30fps ticker; onboarding cycles rich expressions; hop/spin tricks stay off.
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
  const wrapRef = useRef<HTMLSpanElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const botRef = useRef<GrokCharacterLike | null>(null)
  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState(true)
  const shapeRef = useRef(shape)
  const colorRef = useRef(color)
  const busyRef = useRef(busy)
  shapeRef.current = shape
  colorRef.current = color
  busyRef.current = busy

  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    let root: Element | null = null
    let node: HTMLElement | null = el.parentElement
    while (node) {
      const { overflowY } = getComputedStyle(node)
      if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
        root = node
        break
      }
      node = node.parentElement
    }
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        setVisible(Boolean(entry?.isIntersecting))
      },
      { root, rootMargin: '32px 0px', threshold: 0.01 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadGrokBot().then(() => {
      if (cancelled || !svgRef.current || !window.GrokCharacter) return
      if (botRef.current) {
        detachSharedTicker(botRef.current)
        botRef.current.destroy()
      }
      const bot = new window.GrokCharacter(svgRef.current, {
        shape: shapeRef.current,
        color: colorRef.current,
        scheme: 'light',
        loginWrap: true,
        sizePx: size,
        mode: busyRef.current ? 'hold' : 'onboarding',
        state: busyRef.current ? 'thinking' : 'idle',
        followPointer,
        paused: true,
        eyeColor: '#f3efe6',
      }) as BotInternal
      applySidebarMood(bot, busyRef.current)
      attachSharedTicker(bot)
      bot.setPaused(paused || !visible)
      botRef.current = bot
      setReady(true)
    })
    return () => {
      cancelled = true
      if (botRef.current) {
        detachSharedTicker(botRef.current)
        botRef.current.destroy()
        botRef.current = null
      }
    }
    // Recreate only when size / pointer policy changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, followPointer])

  useEffect(() => {
    const bot = botRef.current
    if (!bot || !ready) return
    bot.setShape(shape)
    bot.setColor(color, 'light')
    // setShape can re-arm tricks — keep them off.
    suppressSidebarTricks(bot)
    applySidebarMood(bot, busy)
  }, [shape, color, ready, busy])

  useEffect(() => {
    const bot = botRef.current
    if (!bot || !ready) return
    applySidebarMood(bot, busy)
  }, [busy, ready])

  useEffect(() => {
    botRef.current?.setPaused(paused || !visible)
  }, [paused, visible, ready])

  return (
    <span
      ref={wrapRef}
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
          transform: 'translateZ(0)',
          willChange: 'transform',
        }}
      />
    </span>
  )
})
