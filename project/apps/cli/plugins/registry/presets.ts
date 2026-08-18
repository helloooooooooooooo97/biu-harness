/** [registry] presets：注册类插件——提供 agent 配方注册表（空容器 + 默认配方）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { PresetRegistry } from '@mini-dsh/presets'

export const plugin: Plugin<unknown> = {
  name: 'presets',
  provide: 'presets',
  apply(ctx: Context) {
    ctx.provide('presets', new PresetRegistry({ name: 'default', tools: ['echo', 'skill'] }))
  },
}
