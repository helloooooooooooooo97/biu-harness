import { Service, type Context } from 'cordis'
import '../../types.ts'

export class SubagentsService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'subagents')
  }

  async spawn(prompt: string) {
    const child = await this.ctx.sessions.create()
    const agent = await this.ctx.agents.create(child.id)
    const turn = await agent.send(prompt)
    return { sessionId: child.id, text: turn.text, steps: turn.steps }
  }
}

export const name = 'subagents'
export const inject = ['sessions', 'agents', 'tools']

export function apply(ctx: Context) {
  const subagents = new SubagentsService(ctx)
  ctx.tools.register({
    name: 'subagent_spawn',
    description: '在独立 session 中跑一个子 agent，返回其最终文本',
    parameters: {
      type: 'object',
      properties: { prompt: { type: 'string' } },
      required: ['prompt'],
    },
    execute: (args) => subagents.spawn(String(args.prompt)),
  })
}
