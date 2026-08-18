/** [infrastructure] cancellation：基础设施插件——提供取消令牌服务。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { Cancellation } from '@mini-dsh/cancellation'

export const plugin: Plugin<unknown> = {
  name: 'cancellation',
  provide: 'cancel',
  apply(ctx: Context) {
    ctx.provide('cancel', new Cancellation())
  },
}
