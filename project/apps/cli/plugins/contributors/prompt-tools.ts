/** [contributors] prompt-tools：贡献插件——往提示词组装器贡献工具清单段（可逆）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { SECTION_ORDER, SystemPromptAssembler } from '@mini-dsh/core-system-prompt'

export const plugin: Plugin<unknown> = {
  name: 'prompt-tools',
  inject: ['prompt'],
  apply(ctx: Context) {
    return (ctx.get('prompt') as SystemPromptAssembler).section({
      name: 'tools',
      order: SECTION_ORDER.TOOL_GUIDANCE,
      text: '- echo\n- skill',
    })
  },
}
