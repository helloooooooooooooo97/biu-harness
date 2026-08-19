import { Service, type Context } from 'cordis'
import type { PageSpec } from '../../types.ts'

export class PagesService extends Service {
  private pages: PageSpec[] = []

  constructor(ctx: Context) {
    super(ctx, 'pages')
  }

  register(page: PageSpec) {
    return this.ctx.effect(() => {
      this.pages.push(page)
      this.ctx.emit('pages/update')
      return () => {
        this.pages = this.pages.filter((item) => item !== page)
        this.ctx.emit('pages/update')
      }
    }, `pages.register ${page.id}`)
  }

  list() {
    return [...this.pages]
  }
}

export const name = 'pages'
export const inject = [] as const

export function apply(ctx: Context) {
  new PagesService(ctx)
}
