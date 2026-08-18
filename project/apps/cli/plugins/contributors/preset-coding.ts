/** [contributors] preset-coding：贡献插件——往配方注册表贡献 coding 配方（可逆）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { PresetRegistry } from '@mini-dsh/presets'

export const plugin: Plugin<unknown> = {
  name: 'preset-coding',
  inject: ['presets'],
  apply(ctx: Context) {
    const presets = ctx.get('presets') as PresetRegistry
    return presets.register({ name: 'coding', tools: ['echo', 'bash', 'skill'] })
  },
}
