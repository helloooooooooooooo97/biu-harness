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
  /** Agent running → thinking + green status dot */
  busy?: boolean
  /** 刚创建：播放 intro 动画（毫秒），默认 0 表示不播 */
  introMs?: number
  /** 彩蛋：进入持续庆祝/跳舞动画（spinWild 循环） */
  dancing?: boolean
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

function moodFor(
  busy: boolean,
  intro: boolean,
  dancing: boolean,
): 'static' | 'intro' | 'busy' | 'dancing' {
  if (dancing) return 'dancing'
  if (busy) return 'busy'
  if (intro) return 'intro'
  return 'static'
}

/**
 * Sidebar / hero Grok bot.
 * 默认静止；仅 busy 或 intro 窗口内才跑 shared ticker，减轻侧栏开销。
 */
export const GrokBotAvatar = memo(function GrokBotAvatar({
  shape,
  color,
  size = 44,
  busy = false,
  introMs = 0,
  dancing = false,
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
  const [introActive, setIntroActive] = useState(introMs > 0)
  const shapeRef = useRef(shape)
  const colorRef = useRef(color)
  const busyRef = useRef(busy)
  const introRef = useRef(introActive)
  const danceRef = useRef(dancing)
  shapeRef.current = shape
  colorRef.current = color
  busyRef.current = busy
  introRef.current = introActive
  danceRef.current = dancing

  const shouldAnimate = busy || introActive || dancing

  useEffect(() => {
    if (introMs <= 0) {
      setIntroActive(false)
      return
    }
    setIntroActive(true)
    const timer = window.setTimeout(() => setIntroActive(false), introMs)
    return () => window.clearTimeout(timer)
  }, [introMs])

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
      const mood = moodFor(busyRef.current, introRef.current, danceRef.current)
      const bot = new window.GrokCharacter(svgRef.current, {
        shape: shapeRef.current,
        color: colorRef.current,
        scheme: 'light',
        loginWrap: true,
        sizePx: size,
        mode: mood === 'intro' ? 'onboarding' : 'hold',
        state: mood === 'busy' ? 'thinking' : 'idle',
        followPointer,
        paused: true,
        eyeColor: '#f3efe6',
      }) as BotInternal
      applySidebarMood(bot, mood)
      attachSharedTicker(bot)
      const animate = busyRef.current || introRef.current || danceRef.current
      bot.setPaused(paused || !visible || !animate)
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
    suppressSidebarTricks(bot)
    applySidebarMood(bot, moodFor(busy, introActive, dancing))
  }, [shape, color, ready, busy, introActive, dancing])

  useEffect(() => {
    const bot = botRef.current
    if (!bot || !ready) return
    applySidebarMood(bot, moodFor(busy, introActive, dancing))
  }, [busy, introActive, dancing, ready])

  useEffect(() => {
    botRef.current?.setPaused(paused || !visible || !shouldAnimate)
  }, [paused, visible, ready, shouldAnimate])

  return (
    <span
      ref={wrapRef}
      className={`sidebar-mascot grok-bot-avatar${busy ? ' is-busy' : ''}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size, display: 'inline-grid', placeItems: 'center' }}
      title={title}
      data-busy={busy ? 'true' : undefined}
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
        }}
      />
      {busy ? <span className="sidebar-mascot-status" aria-hidden /> : null}
    </span>
  )
})
