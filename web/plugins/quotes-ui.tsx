import type { Context } from 'cordis'
import type { SlotProps } from '../ui-slots/types.ts'

export const name = 'quotes-ui'
export const inject = ['slots']

function QuotesCard(_props: SlotProps) {
  return (
    <article className="card">
      <h3>旁白</h3>
      <p className="sub">和 Harness 的 conversation.chat.node keyed renderer 一样：声明方不知道贡献方是谁</p>
      <p className="output">打开后再写便签，会经过 notes/filter。</p>
    </article>
  )
}

export function apply(ctx: Context) {
  ctx.slots.inject('stage', () =>
    ctx.slots.register({ name: 'stage', key: 'quotes' }, QuotesCard),
  )
}
