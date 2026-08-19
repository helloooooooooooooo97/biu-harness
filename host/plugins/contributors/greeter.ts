import { Service, type Context } from 'cordis'
import '../../types.ts'

export class GreetService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'greet')
  }

  say(name: string) {
    const raw = `你好，${name}。这里的每一块能力都来自一个 Cordis 插件。`
    return this.ctx.waterfall('greet/transform', raw, () => raw)
  }
}

export const name = 'greeter'
export const inject = ['http', 'hub']

export function apply(ctx: Context) {
  // ctx.provide: 注意这里的ctx是这个fiber的ctx，而不是别的ctx，所以当这个插件注销的时候，只会逆序注销这个插件的ctx
  const greet = new GreetService(ctx)

  // ctx.effect()
  ctx.hub.register({
    id: 'greet',
    title: '问候',
    subtitle: '调用 ctx.greet',
    plugin: 'greeter',
    kind: 'greet',
  })

  // ctx.effect()
  ctx.http.route('GET', '/api/greet', (route) => {
    route.send(200, { text: greet.say(route.query.get('name') || '访客') })
  })
}
