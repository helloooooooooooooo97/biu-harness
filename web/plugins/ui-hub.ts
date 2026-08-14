import type { Context, Fiber, Plugin } from 'cordis'
import * as greetUi from './greet-ui.tsx'
import * as notesUi from './notes-ui.tsx'
import * as clockUi from './clock-ui.tsx'
import * as quotesUi from './quotes-ui.tsx'

const uiCatalog: Record<string, Plugin> = {
  greeter: greetUi,
  notes: notesUi,
  clock: clockUi,
  quotes: quotesUi,
}

export const name = 'ui-hub'
export const inject = ['slots', 'snapshot']

export function apply(ctx: Context) {
  const forks = new Map<string, Fiber>()
  let pending = false
  let running = false

  async function sync() {
    if (running) {
      pending = true
      return
    }
    running = true
    try {
      const enabled = new Set(
        ctx.snapshot.get().plugins.filter((plugin) => plugin.enabled).map((plugin) => plugin.id),
      )
      for (const [id, plugin] of Object.entries(uiCatalog)) {
        const should = enabled.has(id)
        const fiber = forks.get(id)
        if (should && !fiber) {
          forks.set(id, ctx.plugin(plugin))
        } else if (!should && fiber) {
          await fiber.dispose()
          forks.delete(id)
        }
      }
    } finally {
      running = false
      if (pending) {
        pending = false
        await sync()
      }
    }
  }

  ctx.snapshot.subscribe(() => {
    void sync()
  })
  void sync()
}
