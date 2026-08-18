/** workflow 插件：提供工作流编排服务。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { SubagentRegistry } from '@mini-dsh/subagent'
import { Orchestrator } from '@mini-dsh/workflow'

export const plugin: Plugin<unknown> = {
  name: 'workflow',
  provide: 'workflow',
  inject: ['subagents'],
  apply(ctx: Context) {
    ctx.provide('workflow', new Orchestrator(ctx.get('subagents') as SubagentRegistry))
  },
}
