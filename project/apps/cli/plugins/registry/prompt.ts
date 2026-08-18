/** [registry] prompt：注册类插件——提供系统提示词组装器服务（section 可注册/可注销）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { SystemPromptAssembler } from '@mini-dsh/core-system-prompt'

export const plugin: Plugin<unknown> = {
  name: 'prompt',
  provide: 'prompt',
  apply(ctx: Context) {
    ctx.provide('prompt', new SystemPromptAssembler())
  },
}
