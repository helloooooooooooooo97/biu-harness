import { ping } from './util.ts'

export const name = 'store-heavy-ping'
export const inject = ['http']

export function apply(ctx: {
  http: { route: (method: string, path: string, handler: (route: { send: (status: number, body: unknown) => void }) => void) => void }
}) {
  ctx.http.route('GET', '/api/store-heavy-ping', (route) => {
    route.send(200, { ping, heavy: true })
  })
}
