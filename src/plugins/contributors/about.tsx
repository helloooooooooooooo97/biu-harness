import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'

export const name = 'about-ui'
export const inject = ['slots']

function AboutCard(_props: SlotProps) {
  return (
    <article className="card">
      <h2>说明</h2>
      <p>同一条 stage 缝可以填多张卡，按 order 排列。</p>
    </article>
  )
}

export function apply(ctx: Context) {

  ctx.slots.inject('stage', () => ctx.slots.fill('stage', AboutCard, { key: 'about', order: 20 }))
}
