/** telemetry 插件：提供遥测 / 用量计量 / 成本三个服务。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { CostCalculator, Telemetry, TokenMeter } from '@mini-dsh/telemetry'

export const plugin: Plugin<unknown> = {
  name: 'telemetry',
  provide: ['telemetry', 'meter', 'cost'],
  apply(ctx: Context) {
    ctx.provide('telemetry', new Telemetry())
    ctx.provide('meter', new TokenMeter())
    ctx.provide('cost', new CostCalculator({ promptPerM: 1, completionPerM: 2 }))
  },
}
