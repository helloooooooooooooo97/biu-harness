import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'

export const name = 'hello-ui'
export const inject = ['slots']

function HelloCard(_props: SlotProps) {
  return (
    <article className="card">
      <h2>问候</h2>
      <p>inject('stage')：壳还没声明时先等，声明后再 fill。</p>
    </article>
  )
}

export function apply(ctx: Context) {
  ctx.slots.inject('stage', () => ctx.slots.fill('stage', HelloCard, { key: 'hello', order: 10 }))
}
