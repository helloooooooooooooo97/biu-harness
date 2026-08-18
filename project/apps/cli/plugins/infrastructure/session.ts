/** [infrastructure] session：基础设施插件——提供会话日志服务（数据缓存在根 state，服务可热替换）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { SessionLog } from '@mini-dsh/core-session'

function sessionFromState(ctx: Context): SessionLog {
  const state = ctx.get('state') as Map<string, unknown>
  const cached = state.get('session') as SessionLog | undefined
  if (cached) return cached
  const log = new SessionLog()
  state.set('session', log)
  return log
}

export const plugin: Plugin<unknown> = {
  name: 'session',
  provide: 'session',
  inject: ['state'],
  apply(ctx: Context) {
    ctx.provide('session', sessionFromState(ctx))
  },
}
