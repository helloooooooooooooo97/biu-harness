/** guard 插件：提供工作区守卫服务。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { WorkspaceGuard } from '@mini-dsh/guard'

export const plugin: Plugin<unknown> = {
  name: 'guard',
  provide: 'guard',
  apply(ctx: Context) {
    ctx.provide('guard', new WorkspaceGuard(process.cwd()))
  },
}
