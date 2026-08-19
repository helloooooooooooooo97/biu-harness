import type { Context, Fiber, Plugin } from 'cordis'
import * as hello from '../contributors/hello.tsx'
import * as notes from '../contributors/notes.tsx'
import * as clock from '../contributors/clock.tsx'
import * as quotes from '../contributors/quotes.tsx'
import * as chat from '../contributors/chat.tsx'
import * as chatConfig from '../contributors/chat-config.tsx'

const uiCatalog: Record<string, Plugin | Plugin[]> = {
  greeter: hello,
  notes,
  clock,
  quotes,
  chat: [chat, chatConfig],
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
      const enabled = new Set(ctx.snapshot.get().plugins.filter((plugin) => plugin.enabled).map((plugin) => plugin.id))
      for (const [id, pack] of Object.entries(uiCatalog)) {
        const plugins = Array.isArray(pack) ? pack : [pack]
        const should = enabled.has(id)
        for (const [index, plugin] of plugins.entries()) {
          const key = `${id}:${index}`
          const fiber = forks.get(key)
          if (should && !fiber) forks.set(key, ctx.plugin(plugin))
          else if (!should && fiber) {
            await fiber.dispose()
            forks.delete(key)
          }
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
