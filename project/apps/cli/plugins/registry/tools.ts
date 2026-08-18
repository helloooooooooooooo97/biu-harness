/** [registry] tools：注册类插件——提供工具注册表（空容器）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { MemoryTools } from '@mini-dsh/core-tools'

export const plugin: Plugin<unknown> = {
  name: 'tools',
  provide: 'tools',
  apply(ctx: Context) {
    ctx.provide('tools', new MemoryTools())
  },
}
