import type { Context } from 'cordis'
import '../../types.ts'

export const name = 'quotes'
export const inject = ['notes', 'pages']

export function apply(ctx: Context) {
  ctx.pages.register({
    id: 'quotes',
    title: '旁白',
    subtitle: '挂在 notes/filter 上',
    plugin: 'quotes',
    kind: 'quotes',
  })
  ctx.on('notes/filter', (_body, next) => `${next()} · — 可逆副作用`)
}
