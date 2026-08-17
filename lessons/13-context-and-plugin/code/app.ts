/**
 * 一切皆插件的最小组装：sections → tools → prompt → ui。
 */
import { Context } from './context.ts'
import { promptPlugin, sectionsPlugin, toolsPlugin, uiPlugin } from './plugins.ts'

export function createMiniApp(): Context {
  const ctx = new Context()
  ctx.plugin(sectionsPlugin)
  ctx.plugin(toolsPlugin)
  ctx.plugin(promptPlugin)
  ctx.plugin(uiPlugin)
  return ctx
}
