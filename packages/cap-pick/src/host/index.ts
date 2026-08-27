import type { Context } from 'cordis'

export const name = 'pick'
export const inject = ['systemPrompt']

export function apply(ctx: Context) {
  ctx.systemPrompt.register(
    'pick',
    '若用户消息含一条或多条 <pick kind id ... />，必须针对这些 kind/id（及可选 action）操作，不要另找对象。这是界面选取的数据句柄，不是 UI 截图。kind 常见：session、task、plugin、message、reply、tool、step、event（轨迹行 seq）、turn、usage。',
  )
}
