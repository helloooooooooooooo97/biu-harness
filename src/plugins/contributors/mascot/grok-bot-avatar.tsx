import { memo, useEffect, useRef, useState } from 'react'
import { loadGrokBot } from './grok-bot-loader.ts'
import type { GrokCharacterLike, GrokColor, GrokShape } from './grok-bot-types.ts'

export type GrokBotAvatarProps = {
  shape: GrokShape
  color: GrokColor
  size?: number
  /** Agent running → thinking; else onboarding idle cycle */
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
}

/** Stop empty RAF while paused — vendored setPaused still schedules frames. */
function patchPauseStopsRaf(bot: GrokCharacterLike) {
  const raw = bot as BotInternal
  if ((raw as { __pausePatched?: boolean }).__pausePatched) return
  const tick = raw._tick.bind(raw)
  raw._tick = (now: number) => {
    if (raw.paused) {
      raw._raf = 0
      return
    }
    tick(now)
  }
  const setPaused = raw.setPaused.bind(raw)
  raw.setPaused = (v: boolean) => {
    setPaused(v)
    if (raw.paused) {
      if (raw._raf) cancelAnimationFrame(raw._raf)
      raw._raf = 0
      return
    }
    if (!raw._raf) {
      raw.last = performance.now()
      raw._raf = requestAnimationFrame((t) => raw._tick(t))
    }
  }
  ;(raw as { __pausePatched?: boolean }).__pausePatched = true
}

/**
 * Animated Grok Bot character.
 * Stable across session switches (shape/color set in place).
 * Off-screen / paused instances cancel RAF so chat swaps stay smooth.
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
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        setVisible(Boolean(entry?.isIntersecting))
      },
      { root: null, threshold: 0.01 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadGrokBot().then(() => {
      if (cancelled || !svgRef.current || !window.GrokCharacter) return
      botRef.current?.destroy()
      const bot = new window.GrokCharacter(svgRef.current, {
        shape: shapeRef.current,
        color: colorRef.current,
        scheme: 'light',
        loginWrap: true,
        sizePx: size,
        mode: busyRef.current ? 'hold' : 'onboarding',
        state: busyRef.current ? 'thinking' : 'idle',
        followPointer,
        paused: paused || !visible,
        eyeColor: '#f3efe6',
      })
      patchPauseStopsRaf(bot)
      botRef.current = bot
      setReady(true)
    })
    return () => {
      cancelled = true
      botRef.current?.destroy()
      botRef.current = null
    }
    // Recreate only when size / pointer policy changes.
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
        }}
      />
    </span>
  )
})
