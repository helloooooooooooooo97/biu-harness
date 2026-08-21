import type { Context, Fiber, Plugin } from 'cordis'
import * as notes from '../contributors/notes.tsx'
import * as clock from '../contributors/clock.tsx'
import * as quotes from '../contributors/quotes.tsx'
import * as chat from '../contributors/chat/index.ts'
import { uiPackageLoaders } from 'virtual:cordis-ui-loaders'

/** 仍留在主仓的内置 UI 插件（未拆包）。外部 UI 只来自 virtual:cordis-ui-loaders（由配置生成）。 */
const builtinUi: Record<string, Plugin> = {
  notes,
  clock,
  quotes,
  chat,
}

export const name = 'ui-hub'
export const inject = ['slots', 'snapshot']

export function apply(ctx: Context) {
  const forks = new Map<string, Fiber>()
  let pending = false
  let running = false

  async function resolvePlugin(id: string, ui?: string): Promise<Plugin | undefined> {
    if (builtinUi[id]) return builtinUi[id]
    if (ui) {
      const loader = uiPackageLoaders[ui]
      if (loader) return loader()
    }
    return undefined
  }

  async function sync() {
    if (running) {
      pending = true
      return
    }
    running = true
    try {
      const rows = ctx.snapshot.get().plugins
      const enabledRows = rows.filter((plugin) => plugin.enabled)
      const enabledIds = new Set(enabledRows.map((plugin) => plugin.id))

      for (const row of enabledRows) {
        if (forks.has(row.id)) continue
        const plugin = await resolvePlugin(row.id, row.ui)
        if (!plugin) continue
        forks.set(row.id, ctx.plugin(plugin))
      }

      for (const [id, fiber] of [...forks.entries()]) {
        if (enabledIds.has(id)) continue
        await fiber.dispose()
        forks.delete(id)
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
