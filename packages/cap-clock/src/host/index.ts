import type { Context } from 'cordis'

declare module 'cordis' {
  interface Events {
    'clock/tick'(iso: string): void
  }
}

export const name = 'clock'
export const inject = ['http', 'hub', 'tools']

export function apply(ctx: Context) {
  let lastIso = new Date().toISOString()
  ctx.tools.register({
    name: 'clock_now',
    description: '读取最近一次心跳时间',
    parameters: { type: 'object', properties: {} },
    execute: () => lastIso,
  })
  ctx.hub.register({
    id: 'clock',
    title: '心跳',
    subtitle: '定时器包在 ctx.effect 里',
    plugin: 'clock',
    kind: 'clock',
  })
  ctx.effect(() => {
    const tick = () => {
      const iso = new Date().toISOString()
      lastIso = iso
      ctx.emit('clock/tick', iso)
      ctx.http.broadcast('clock', { iso })
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, 'clock.interval')
}
