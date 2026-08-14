import type { Context } from 'cordis'
import '../types.ts'

export const name = 'quotes'
export const inject = ['notes', 'pages']

export function apply(ctx: Context) {
  ctx.pages.register({
    id: 'quotes',
    title: '旁白',
    subtitle: '在 notes/filter 上包一层，不改便签插件源码',
    plugin: 'quotes',
    kind: 'quotes',
  })

  ctx.on('notes/filter', (body, next) => {
    const text = next()
    return `${text} · — 可逆副作用`
  })
}
