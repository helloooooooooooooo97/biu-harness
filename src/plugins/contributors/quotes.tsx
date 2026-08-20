import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'

export const name = 'quotes-ui'
export const inject = ['slots']

function QuotesCard(_props: SlotProps) {
  return (
    <article className="space-y-2 rounded-2xl bg-[#2d2e30] px-3 py-3">
      <h2 className="mb-1 text-sm font-medium">旁白</h2>
      <p className="text-sm leading-6 text-[#9aa0a6]">打开后再写便签，会经过 notes/filter。</p>
    </article>
  )
}

export function apply(ctx: Context) {
  ctx.slots.place('rail', QuotesCard, { key: 'quotes', order: 25 })
}
