/** [orchestration] agent-loop-v2：编排插件——同一 agentLoop 服务的第二个实现（换配置即换 loop）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'

export const plugin: Plugin<unknown> = {
  name: 'agent-loop-v2',
  provide: 'agentLoop',
  apply(ctx: Context) {
    ctx.provide('agentLoop', {
      async run(prompt: string) {
        return { turn: 1, steps: 1, reply: `[loop-v2] ${prompt}` }
      },
    })
  },
}
