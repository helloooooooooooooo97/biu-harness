import { createRoot } from 'react-dom/client'
import type { Context } from 'cordis'
import { createSlotRenderer } from './renderer.tsx'

export const name = 'web-react'
export const inject = ['slots']

export function apply(ctx: Context, config: { el: HTMLElement }) {
  ctx.slots.install(createSlotRenderer())
  ctx.effect(() => {
    const root = createRoot(config.el)
    root.render(ctx.slots.renderSlot('root'))
    return () => root.unmount()
  }, 'react.createRoot')
}
