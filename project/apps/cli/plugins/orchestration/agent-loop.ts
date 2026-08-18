/** [orchestration] agent-loop：编排插件——提供回合循环服务（真正的 agent loop）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { TurnRunner } from '@mini-dsh/core-agent-loop'
import { SessionLog } from '@mini-dsh/core-session'
import { MemoryTools } from '@mini-dsh/core-tools'
import type { LlmClient } from '@mini-dsh/llm'

export const plugin: Plugin<unknown> = {
  name: 'agent-loop',
  provide: 'agentLoop',
  inject: ['llm', 'session', 'tools'],
  apply(ctx: Context) {
    ctx.provide('agentLoop', new TurnRunner({
      llm: ctx.get('llm') as LlmClient,
      session: ctx.get('session') as SessionLog,
      tools: ctx.get('tools') as MemoryTools,
    }))
  },
}
