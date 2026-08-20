import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'

export const name = 'quotes-ui'
export const inject = ['slots']

function QuotesCard(_props: SlotProps) {
  return (
    <article className="space-y-2 rounded-[12px] border border-[var(--dsw-border)] bg-white px-3 py-3">
      <h2 className="mb-1 text-sm font-medium">Quotes demo</h2>
      <p className="text-sm leading-6 text-[var(--dsw-label-3)]">When enabled, notes pass through notes/filter.</p>
    </article>
  )
}

export function apply(ctx: Context) {
  ctx.slots.place('demos', QuotesCard, { key: 'quotes', order: 25 })
}
