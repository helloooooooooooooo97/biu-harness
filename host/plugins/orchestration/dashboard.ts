import type { Context } from 'cordis'
import '../../types.ts'

export const name = 'dashboard'
export const inject = ['http', 'pages', 'hub']

export function apply(ctx: Context) {
  ctx.http.route('GET', '/api/snapshot', (route) => {
    route.send(200, ctx.hub.snapshot())
  })
  ctx.http.route('POST', '/api/plugins/:id', async (route) => {
    const payload = (await route.json()) as { enabled?: boolean }
    try {
      route.send(200, await ctx.hub.setEnabled(route.params.id, Boolean(payload.enabled)))
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })
}
