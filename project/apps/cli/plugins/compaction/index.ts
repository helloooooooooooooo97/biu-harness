/** compaction 插件：提供上下文压缩服务。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { CompactionRunner, PressureMonitor } from '@mini-dsh/compaction'

export const plugin: Plugin<unknown> = {
  name: 'compaction',
  provide: 'compaction',
  apply(ctx: Context) {
    ctx.provide('compaction', new CompactionRunner(new PressureMonitor(2000)))
  },
}
