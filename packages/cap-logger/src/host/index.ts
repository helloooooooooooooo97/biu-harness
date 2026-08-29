import type { Context } from 'cordis'

export const name = 'logger'
export const inject = ['http']

/** 秒级心跳 / 路由登记会把控制台和 EventLog 打满，启动时尤其明显。 */
export const NOISY_EVENTS = new Set(['clock/tick', 'hub/change'])

export function shouldLogDispatch(name: string) {
  if (name.startsWith('internal/')) return false
  return !NOISY_EVENTS.has(name)
}

export function apply(ctx: Context) {
  ctx.on('internal/dispatch', (mode, name) => {
    if (!shouldLogDispatch(name)) return
    ctx.logger('logger').info(`${mode} ${name}`)
  })
}
