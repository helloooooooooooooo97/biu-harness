import { createRoot } from 'react-dom/client'
import type { Context } from 'cordis'
import { SlotEvent } from '@biu/web-slots'
import { renderRoot } from './renderer.tsx'

export const name = 'react-host'
export const inject = ['slots', 'appModules']

export function apply(ctx: Context, config: { el: HTMLElement }) {
  ctx.effect(() => {
    const root = createRoot(config.el)
    const paint = () => root.render(renderRoot(ctx.slots, ctx.get('appModules')))
    const stop = ctx.slots.subscribe('root', SlotEvent.Entries, paint)
    paint()
    return () => {
      stop()
      root.unmount()
    }
  }, 'react-host')
}
