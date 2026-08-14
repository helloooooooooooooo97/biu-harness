import { createRoot } from 'react-dom/client'
import type { Context } from 'cordis'
import { createSlotRenderer } from './renderer.tsx'

export const name = 'web-react'
export const inject = ['slots']

export function apply(ctx: Context, config: { el: HTMLElement }) {
  ctx.slots.install(createSlotRenderer())
  const root = createRoot(config.el)
  ctx.effect(() => {
    const paint = () => root.render(ctx.slots.renderSlot('root'))
    const stop = ctx.slots.subscribe('root', paint)
    paint()
    return () => {
      stop()
      root.unmount()
    }
  }, 'web-react.createRoot')
}
