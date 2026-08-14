import { Service, type Context } from 'cordis'
import '../types.ts'

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
export const inject = ['http', 'pages']

export function apply(ctx: Context) {
  const greet = new GreetService(ctx)

  ctx.pages.register({
    id: 'greet',
    title: '问候',
    subtitle: '调用 ctx.greet，观察 waterfall 如何改写返回值',
    plugin: 'greeter',
    kind: 'greet',
  })

  ctx.http.route('GET', '/api/greet', (route) => {
    const name = route.query.get('name') || '访客'
    route.send(200, { text: greet.say(name) })
  })
}
