/** prompt-identity 插件：往提示词组装器贡献 identity 段（可逆）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { SECTION_ORDER, SystemPromptAssembler } from '@mini-dsh/core-system-prompt'

export const plugin: Plugin<unknown> = {
  name: 'prompt-identity',
  inject: ['prompt'],
  apply(ctx: Context) {
    return (ctx.get('prompt') as SystemPromptAssembler).section({
      name: 'identity',
      order: SECTION_ORDER.HARNESS_IDENTITY,
      text: '你是 mini-dsh。',
    })
  },
}
