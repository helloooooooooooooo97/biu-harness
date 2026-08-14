import type { Context } from 'cordis'
import '../types.ts'

export const name = 'clock'
export const inject = ['http', 'pages']

export function apply(ctx: Context) {
  ctx.pages.register({
    id: 'clock',
    title: '心跳',
    subtitle: '定时器包在 ctx.effect 里，卸载即停',
    plugin: 'clock',
    kind: 'clock',
  })

  ctx.effect(() => {
    const tick = () => {
      const iso = new Date().toISOString()
      ctx.emit('clock/tick', iso)
      ctx.http.broadcast('clock', { iso })
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, 'clock.interval')
}
