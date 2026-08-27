import type { Context } from 'cordis'

export const name = 'pick'
export const inject = ['systemPrompt']

export function apply(ctx: Context) {
  ctx.systemPrompt.register(
    'pick',
    '若用户消息含 <pick kind id ... />，必须针对该 kind/id（及可选 action）操作，不要另找对象。这是界面选取的数据句柄，不是 UI 截图。',
  )
}
