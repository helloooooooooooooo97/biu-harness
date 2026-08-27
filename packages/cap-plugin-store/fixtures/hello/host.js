/** Prebuilt Host half — the app never compiles this file. */
export const name = 'store-hello'
export const inject = ['http']

export function apply(ctx) {
  ctx.http.route('GET', '/api/store-hello', (route) => {
    route.send(200, { message: 'hello from store plugin', installed: true })
  })
}
