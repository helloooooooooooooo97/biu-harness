import type { Context } from 'cordis'
import '../types.ts'

export const name = 'uppercase'
export const inject = ['greet']

export function apply(ctx: Context) {
  ctx.on('greet/transform', (text, next) => next().toUpperCase())
}
