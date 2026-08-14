import type { Context } from 'cordis'

export const name = 'polite'
export const inject = ['notes']

export function apply(ctx: Context) {
  ctx.on('notes/filter', (text, next) => {
    const body = next()
    if (body.startsWith('请')) return body
    return `请留意：${body}`
  })
}
