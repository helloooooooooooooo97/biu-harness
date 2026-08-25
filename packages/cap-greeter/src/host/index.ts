import { Service, type Context } from 'cordis'

/** 与 host Context 解耦：包内不做全局 declare module，避免冲掉 host/types。 */
type HostCtx = Context & {
  http: {
    route: (
      method: string,
      pattern: string,
      handler: (route: { query: URLSearchParams; send: (status: number, body: unknown) => void }) => void,
    ) => unknown
  }
  hub: {
    register: (page: {
      id: string
      title: string
      subtitle: string
      plugin: string
      kind: string
    }) => unknown
  }
  tools: {
    register: (spec: {
      name: string
      description: string
      parameters: Record<string, unknown>
      execute: (args: Record<string, unknown>) => unknown
    }) => unknown
  }
  waterfall: (name: string, value: string, fallback: () => string) => string
}

declare module 'cordis' {
  interface Events {
    'greet/transform'(text: string, next: () => string): string
  }
}

export class GreetService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'greet')
  }

  say(name: string) {
    const host = this.ctx as HostCtx
    const raw = `你好，${name}。这里的每一块能力都来自一个 Cordis 插件。`
    return host.waterfall('greet/transform', raw, () => raw)
  }
}

export const name = 'greeter'
export const inject = ['http', 'hub', 'tools']

export function apply(ctx: Context) {
  const host = ctx as HostCtx
  const greet = new GreetService(ctx)

  host.tools.register({
    name: 'greet',
    description: '用问候服务生成一句话',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: '称呼' } },
    },
    execute: (args) => greet.say(String(args.name || '访客')),
  })

  host.hub.register({
    id: 'greet',
    title: '问候',
    subtitle: '调用 ctx.greet（@biu/cap-greeter/host）',
    plugin: 'greeter',
    kind: 'greet',
  })

  host.http.route('GET', '/api/greet', (route) => {
    route.send(200, { text: greet.say(route.query.get('name') || '访客') })
  })
}
