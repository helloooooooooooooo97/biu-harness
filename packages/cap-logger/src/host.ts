import type { Context } from 'cordis'

export const name = 'logger'
export const inject = ['http']

export function apply(ctx: Context) {
  ctx.on('internal/dispatch', (mode, name) => {
    if (name.startsWith('internal/')) return
    ctx.logger('logger').info(`${mode} ${name}`)
  })
}
