/** [contributors] subagent-inprocess：贡献插件——贡献进程内子代理提供者（可逆）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { InProcessProvider, SubagentRegistry } from '@mini-dsh/subagent'
import type { LlmClient } from '@mini-dsh/llm'

export const plugin: Plugin<unknown> = {
  name: 'subagent-inprocess',
  inject: ['subagents', 'llm'],
  apply(ctx: Context) {
    return (ctx.get('subagents') as SubagentRegistry).register(new InProcessProvider(ctx.get('llm') as LlmClient))
  },
}
