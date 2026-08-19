import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'

export const name = 'shell'
export const inject = ['slots']

function Shell(props: SlotProps) {
  return (
    <div className="layout">
      <header className="top">
        <h1>hmr-dev</h1>
        <p>壳用 children 声明缝；业务插件 inject 等到缝出现再 fill。</p>
      </header>
      <aside className="side">{props.renderSlot('sidebar', { kind: 'single' })}</aside>
      <main className="stage">{props.renderSlot('stage', { kind: 'list' })}</main>
    </div>
  )
}

export function apply(ctx: Context) {
  ctx.slots.fill('root', Shell, {
    children: {
      sidebar: { kind: 'single' },
      stage: { kind: 'list' },
    },
  })
}
