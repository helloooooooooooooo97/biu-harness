import type { Context } from 'cordis'

declare module 'cordis' {
  interface Events {
    'greet/transform'(text: string, next: () => string): string
  }
}

export const name = 'uppercase'
export const inject = ['greet']

export function apply(ctx: Context) {
  ctx.on('greet/transform', (_text, next) => next().toUpperCase())
}
