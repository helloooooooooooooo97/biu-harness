import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'

export const name = 'nav-ui'
export const inject = ['slots']

function Nav(_props: SlotProps) {
  return (
    <nav>
      <h2>侧栏</h2>
      <p>填 sidebar。single：先登记的显示，后到的仍留在表里但不画。</p>
    </nav>
  )
}

export function apply(ctx: Context) {
  ctx.slots.place('sidebar', Nav, { key: 'nav' })
}
