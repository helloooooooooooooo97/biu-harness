/** rpc 插件：提供 JSON-RPC 入口（对外暴露 run / ping / status / workflow）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { JsonRpcServer } from '@mini-dsh/entrypoints'
import { Orchestrator } from '@mini-dsh/workflow'
import { CostCalculator, Telemetry, TokenMeter } from '@mini-dsh/telemetry'

export const plugin: Plugin<unknown> = {
  name: 'rpc',
  provide: 'rpc',
  inject: ['headless', 'workflow', 'telemetry', 'meter', 'cost'],
  apply(ctx: Context) {
    const headless = ctx.get('headless') as { run(p: string): Promise<{ reply: string }> }
    const workflow = ctx.get('workflow') as Orchestrator
    const telemetry = ctx.get('telemetry') as Telemetry
    const meter = ctx.get('meter') as TokenMeter
    const cost = ctx.get('cost') as CostCalculator
    ctx.provide('rpc', new JsonRpcServer({
      ping: async () => 'pong',
      status: async () => ({ events: telemetry.query().length, tokens: meter.get(), cost: cost.cost(meter.get()) }),
      run: async (params) => (await headless.run(String(params?.prompt ?? ''))).reply,
      workflow: async (params) => [...(await workflow.run(((params?.tasks as Array<{ id: string; prompt: string; deps?: string[] }>) ?? []).map((t) => ({ ...t, provider: 'inprocess' })))).entries()],
    }))
  },
}
