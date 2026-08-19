import type { Context } from 'cordis'

export const name = 'polite'
export const inject = ['notes']

export function apply(ctx: Context) {
  ctx.on('notes/filter', (_text, next) => {
    const body = next()
    return body.startsWith('请') ? body : `请留意：${body}`
  })
}
