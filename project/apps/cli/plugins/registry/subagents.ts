/** [registry] subagents：注册类插件——提供子代理注册表（空容器）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { SubagentRegistry } from '@mini-dsh/subagent'

export const plugin: Plugin<unknown> = {
  name: 'subagents',
  provide: 'subagents',
  apply(ctx: Context) {
    ctx.provide('subagents', new SubagentRegistry())
  },
}
